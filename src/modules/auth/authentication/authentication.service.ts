// src/modules/auth/authentication/authentication.service.ts

import {RoleService} from "../../system/roles/role.service";
import {UserService} from "../../users/services/user.service";
import {TokenService} from "./authentication-token.service";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {AuthenticationToken, JwtExtendedPayload, LoginInput, RegisterInput} from "./authentication.interface";
import {UserRepository} from "../../users/user.repository";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {User} from "../../users/user.interface";
import {AuthenticationTokenRepository} from "./authentication-token.repository";
import {SettingService} from "../../system/settings/setting.service";
import {TwoFactorAuthenticationService} from "../two-factor-authentication/two-factor-authentication.service";
import {__ENV} from "../../../config/environment";

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
    ) {
    }

    /**
     * Executes the business workflow for registering a new customer.
     */
    async register(data: RegisterInput): Promise<{ token: string }> {
        const role = await this.roleService.getRoleBySlug("customer");
        if (!role) {
            throw new AppError(
                Messages.DATA_NOT_FOUND,
                "Default registration roles 'customer' could not be resolved.",
            );
        }

        const hashedPassword = await this.securityUtil.hash(data.password);
        const createdAt = this.dateUtil.sql();

        const newUser = await this.userService.registerUser({
            ...data,
            password: hashedPassword,
            role_id: role.id,
            created_at: createdAt,
        });

        // Persist a revocable session row for this registration token.
        const session = await this.authenticationTokenRepository.create({
            user_id: newUser.id,
            expired_at: this.dateUtil.expiredAt(
                Number(__ENV.JWT_EXPIRATION_DAYS || 7),
                "days",
            ),
            ip: null,
            browser: null,
            os: null,
        });

        const token = this.tokenService.generateToken({
            uid: newUser.id,
            tid: session.id,
            tfa: false,
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: newUser.authorization_version || 0,
        });

        return {token};
    }

    /**
     * Executes the business workflow for user login.
     */
    async login(data: LoginInput): Promise<{ token: string; tfaRequired?: boolean }> {
        const user: User | null = await this.userRepository.findByUsername(data.username);

        // Mitigate Username Enumeration. If user is missing, skip to generic fail block.
        if (!user) {
            // Perform a dummy comparison to reduce timing-based user enumeration.
            await this.securityUtil.compare(
                "$2b$12$00000000000000000000000000000000000000000000000000000",
                data.password,
            );
            this.handleFailedLogin();
        }

        // Enforce account status - only Activated users can authenticate
        if (user.status !== "Activated") {
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
                throw new AppError(Messages.TOO_MANY_ATTEMPTS);
            }

            // Lockout has expired: Reset tracking
            await this.userRepository.update(user.id, {
                failed_login_expired_at: null,
                login_tries: 0
            });
        }

        // Perform constant-time hash comparison
        const isPasswordMatch = await this.securityUtil.compare(user.password, data.password);

        if (!isPasswordMatch) {
            const updatedUser = await this.userRepository.incrementLoginTries(user.id);
            const settings = await this.settingService.getCache();
            const totalLoginTries = Number(updatedUser?.login_tries || 0);

            if (totalLoginTries >= settings.pri.mx_log_try) {
                await this.userRepository.update(user.id, {
                    failed_login_expired_at: this.dateUtil.expiredAt(settings.pri.lck_prd, "minutes"),
                });

                throw new AppError(Messages.LOCKED_ACCOUNT);
            }

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
        await this.authenticationTokenRepository.purgeExpiredTokensByUserId(user.id);

        // Resolve the user's role so authorization claims can be embedded.
        const role = await this.roleService.findById(user.role_id);

        // Persist a revocable session row for this login.
        const session = await this.authenticationTokenRepository.create({
            user_id: user.id,
            expired_at: this.dateUtil.expiredAt(
                Number(__ENV.JWT_EXPIRATION_DAYS || 7),
                "days",
            ),
            ip: null,
            browser: null,
            os: null,
        });

        // generate a JWT token - set tfa to false if TFA is required (user needs to complete TFA)
        const token = this.tokenService.generateToken({
            uid: user.id,
            tid: session.id,
            tfa: !tfaRequired, // false if TFA required, true if not required or disabled
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: user.authorization_version || 0,
        });

        return {token, tfaRequired};
    }

    /**
     * Handles authentication session termination securely.
     */
    async logout(tid: number): Promise<void> {
        const isDeleted = await this.authenticationTokenRepository.deleteById(tid);

        if (!isDeleted) {
            throw new AppError(Messages.DELETE_FAILED);
        }
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

    async findAuthenticationToken(payload: JwtExtendedPayload): Promise<AuthenticationToken> {
        const session = await this.authenticationTokenRepository.findById(payload.tid, payload.uid);
        if (!session) {
            throw new AppError(Messages.SESSION_EXPIRED, "Active token session not found.");
        }
        
        // Check if authorization_version matches (for fresh auth)
        const user = await this.userRepository.findAuthById(payload.uid);
        if (user && payload.av !== undefined && user.authorization_version !== payload.av) {
            throw new AppError(Messages.SESSION_EXPIRED, "Authorization has changed. Please log in again.");
        }
        
        return session;
    }
}