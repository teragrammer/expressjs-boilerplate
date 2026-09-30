// src/modules/auth/services/authentication.service.ts

import {RoleService} from "../../system/roles/role.service";
import {UserService} from "../../users/services/user.service";
import {TokenService} from "./authentication-token.service";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {RegisterInput} from "../interfaces/register-input.interface";
import {LoginInput} from "../interfaces/login-input.interface";
import {UserRepository} from "../../users/user.repository";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {User} from "../../users/user.interface";
import {AuthenticationTokenRepository} from "../repositories/authentication-token.repository";
import {JwtExtendedPayload} from "../interfaces/jwt.interface";
import {AuthenticationToken} from "../interfaces/authentication.token";
import {settingService} from "../../../config/container";

export class AuthenticationService {
    constructor(
        private readonly securityUtil: SecurityUtil,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly roleService: RoleService,
        private readonly userService: UserService,
        private readonly userRepository: UserRepository,
        private readonly tokenService: TokenService,
        private readonly dateUtil: DateUtil
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

        const token = this.tokenService.generateToken({
            uid: newUser.id,
            tid: 0,
            tfa: false,
        });

        return {token};
    }

    /**
     * Executes the business workflow for user login.
     */
    async login(data: LoginInput): Promise<{ token: string }> {
        const user: User | null = await this.userRepository.findByUsername(data.username);

        // Mitigate Username Enumeration. If user is missing, skip to generic fail block.
        if (!user) {
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
            await this.userRepository.incrementLoginTries(user.id);
            const settings = await settingService.getCache();
            const totalLoginTries = Number(user.login_tries || 0) + 1;

            if (totalLoginTries >= settings.pri.mx_log_try) {
                await this.userRepository.update(user.id, {
                    failed_login_expired_at: this.dateUtil.expiredAt(settings.pri.lck_prd, "minutes"),
                });

                throw new AppError(Messages.LOCKED_ACCOUNT);
            }

            this.handleFailedLogin();
        }

        // purge expired tokens
        await this.authenticationTokenRepository.purgeExpiredTokensByUserId(user.id);

        // generate a JWT token
        const token = this.tokenService.generateToken({
            uid: user.id,
            tid: 0,
            tfa: false,
        });

        return {token};
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
        const session = await this.authenticationTokenRepository.findById(payload.tid);
        if (!session) {
            throw new AppError(Messages.SESSION_EXPIRED, "Active token session not found.");
        }
        return session;
    }
}