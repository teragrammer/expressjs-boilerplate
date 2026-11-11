// src/modules/auth/authentication/authentication.service.ts

import {RoleService} from "../../system/roles/role.service";
import {UserService} from "../../users/services/user.service";
import {TokenService} from "./authentication-token.service";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {
    AuthenticationToken,
    JwtExtendedPayload,
    LoginInput,
    RegisterInput,
} from "./authentication.interface";
import {UserRepository} from "../../users/user.repository";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {User} from "../../users/user.interface";
import {AuthenticationTokenRepository} from "./authentication-token.repository";
import {SettingService} from "../../system/settings/setting.service";
import {TwoFactorAuthenticationService} from "../two-factor-authentication/two-factor-authentication.service";
import {SessionService, IssuedTokens} from "./session.service";
import {withTransaction} from "../../../config/database";
import {authAttemptsTotal} from "../../../common/metrics/metrics";
import {__ENV} from "../../../config/environment";

export interface AuthenticatedResult extends IssuedTokens {
    tfaRequired?: boolean;
}

export class AuthenticationService {
    constructor(
        private readonly securityUtil: SecurityUtil,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly roleService: RoleService,
        private readonly userService: UserService,
        private readonly userRepository: UserRepository,
        private readonly tokenService: TokenService,
        private readonly dateUtil: DateUtil,
        private readonly settingService: SettingService,
        private readonly tfaService: TwoFactorAuthenticationService,
        private readonly sessionService: SessionService,
    ) {
    }

    /**
     * Executes the business workflow for registering a new customer.
     *
     * The user row and its session are created in a single transaction:
     * a failed session insert must not leave a half-registered account
     * that blocks a retry on the unique constraint.
     */
    async register(
        data: RegisterInput,
        metadata?: {ip?: string | null; browser?: string | null; os?: string | null; userAgent?: string | null},
    ): Promise<AuthenticatedResult> {
        const role = await this.roleService.getRoleBySlug("customer");
        if (!role) {
            throw new AppError(
                Messages.DATA_NOT_FOUND,
                "Default registration roles 'customer' could not be resolved.",
            );
        }

        const hashedPassword = await this.securityUtil.hash(data.password);

        const newUser = await withTransaction(async (trx) => {
            const created = await this.userService.registerUser(
                {
                    ...data,
                    password: hashedPassword,
                    role_id: role.id,
                    created_at: this.dateUtil.sql(),
                },
                trx,
            );

            const session = await this.authenticationTokenRepository.create(
                {
                    user_id: created.id,
                    expired_at: this.dateUtil.expiredAt(
                        Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7),
                        "days",
                    ),
                    ip: metadata?.ip ?? null,
                    browser: metadata?.browser ?? null,
                    os: metadata?.os ?? null,
                },
                trx,
            );

            return {created, session};
        });

        /*
         * The refresh token is issued after the transaction commits, so
         * a failure cannot leave a session without a credential pair.
         */
        const issued = await this.sessionService.issueForSession(
            newUser.session.id,
            newUser.created,
            role,
            false,
            {
                includeRefreshToken: true,
                metadata: {
                    ip: metadata?.ip ?? null,
                    userAgent: metadata?.userAgent ?? null,
                },
            },
        );

        authAttemptsTotal.inc({event: "register", outcome: "success"});

        return {
            accessToken: issued.accessToken,
            refreshToken: issued.refreshToken,
            sessionId: newUser.session.id,
            expiresAt: issued.expiresAt,
            tfaRequired: false,
        };
    }

    /**
     * Executes the business workflow for user login.
     */
    async login(
        data: LoginInput,
        metadata?: {ip?: string | null; browser?: string | null; os?: string | null; userAgent?: string | null},
    ): Promise<AuthenticatedResult> {
        const user: User | null = await this.userRepository.findByUsername(
            data.username,
        );

        // Mitigate Username Enumeration. If user is missing, skip to generic fail block.
        if (!user) {
            // Perform a dummy comparison to reduce timing-based user enumeration.
            await this.securityUtil.compare(
                "$2b$12$00000000000000000000000000000000000000000000000000000",
                data.password,
            );

            authAttemptsTotal.inc({event: "login", outcome: "failure"});

            this.handleFailedLogin();
        }

        // Enforce account status - only Activated users can authenticate
        if (user.status !== "Activated") {
            authAttemptsTotal.inc({event: "login", outcome: "failure"});

            // Don't reveal the specific status, use generic error
            this.handleFailedLogin();
        }

        if (typeof user.password === "undefined" || user.password === null) {
            throw new AppError(Messages.INCORRECT_PASS_SETUP);
        }

        // Account Lockout verification check
        const expiredAt = user.failed_login_expired_at;
        if (expiredAt) {
            const isLockoutActive = !this.dateUtil.isPast(expiredAt);

            if (isLockoutActive) {
                authAttemptsTotal.inc({event: "login", outcome: "locked"});

                throw new AppError(Messages.TOO_MANY_ATTEMPTS);
            }

            // Lockout has expired: Reset tracking
            await this.userRepository.update(user.id, {
                failed_login_expired_at: null,
                login_tries: 0,
            });
        }

        // Perform constant-time hash comparison
        const isPasswordMatch = await this.securityUtil.compare(
            user.password,
            data.password,
        );

        if (!isPasswordMatch) {
            const updatedUser = await this.userRepository.incrementLoginTries(
                user.id,
            );
            const settings = await this.settingService.getCache();
            const totalLoginTries = Number(updatedUser?.login_tries || 0);

            if (totalLoginTries >= settings.pri.mx_log_try) {
                await this.userRepository.update(user.id, {
                    failed_login_expired_at: this.dateUtil.expiredAt(
                        settings.pri.lck_prd,
                        "minutes",
                    ),
                });

                authAttemptsTotal.inc({event: "login", outcome: "locked"});

                throw new AppError(Messages.LOCKED_ACCOUNT);
            }

            authAttemptsTotal.inc({event: "login", outcome: "failure"});

            this.handleFailedLogin();
        }

        // Reset login tries on successful login
        if (user.login_tries > 0 || user.failed_login_expired_at) {
            await this.userRepository.update(user.id, {
                login_tries: 0,
                failed_login_expired_at: null,
            });
        }

        // Check if TFA is required for this user
        const tfaRequired = await this.tfaService.isTfaRequired(user);

        // purge expired tokens
        await this.authenticationTokenRepository.purgeExpiredTokensByUserId(
            user.id,
        );

        /*
         * Issue the credential pair through the single session
         * authority so every token references a live session row.
         */
        const issued = await this.sessionService.issue(user.id, {
            tfa: !tfaRequired,
            metadata,
        });

        authAttemptsTotal.inc({event: "login", outcome: "success"});

        return {...issued, tfaRequired};
    }

    /**
     * Handles authentication session termination securely.
     */
    async logout(tid: number): Promise<void> {
        const isDeleted =
            await this.authenticationTokenRepository.deleteById(tid);

        if (!isDeleted) {
            throw new AppError(Messages.DELETE_FAILED);
        }
    }

    /**
     * Revokes every session belonging to a user.
     */
    async logoutAll(userId: number): Promise<number> {
        return this.sessionService.revokeAllSessions(userId);
    }

    /**
     * Helper to guarantee consistent, generic error responses for failed logins.
     */
    private handleFailedLogin(): never {
        throw new AppError(
            Messages.CREDENTIAL_DO_NOT_MATCH,
            "Invalid username or password details.",
        );
    }

    /**
     * Resolves the session referenced by an access token.
     *
     * Fails when the session is gone, expired, or belongs to a
     * different user.
     */
    async findAuthenticationToken(
        payload: JwtExtendedPayload,
    ): Promise<AuthenticationToken> {
        const session = await this.authenticationTokenRepository.findById(
            payload.tid,
            payload.uid,
        );

        if (!session) {
            throw new AppError(
                Messages.SESSION_EXPIRED,
                "Active token session not found.",
            );
        }

        /*
         * Check that the authorization version still matches.
         *
         * A role, status or permission change increments the user's
         * authorization version, which invalidates tokens issued before
         * the change without waiting for expiry.
         */
        const user = await this.userRepository.findAuthById(payload.uid);

        if (!user) {
            throw new AppError(
                Messages.SESSION_EXPIRED,
                "Active token session not found.",
            );
        }

        if (user.status !== "Activated") {
            throw new AppError(
                Messages.SESSION_EXPIRED,
                "Active token session not found.",
            );
        }

        if (
            payload.av !== undefined &&
            user.authorization_version !== payload.av
        ) {
            throw new AppError(
                Messages.SESSION_EXPIRED,
                "Authorization has changed. Please log in again.",
            );
        }

        return session;
    }
}
