// src/modules/users/services/account.service.ts
import {SecurityAccountDTO, UpdateUserDTO, User} from "../user.interface";
import {UserRepository} from "../user.repository";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {TokenService} from "../../auth/authentication/authentication-token.service";
import {SecurityUtil} from "../../../common/utils/security.util";
import {AuthenticationTokenRepository} from "../../auth/authentication/authentication-token.repository";
import {RoleService} from "../../system/roles/role.service";
import {DateUtil} from "../../../common/utils/date.util";
import {__ENV} from "../../../config/environment";

export class AccountService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly tokenService: TokenService,
        private readonly securityUtil: SecurityUtil,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly roleService: RoleService,
        private readonly dateUtil: DateUtil,
    ) {
    }

    async information(id: number, data: UpdateUserDTO, currentTid: number, tfa = false): Promise<string> {
        const user: User | null = await this.userRepository.update(id, data, "Activated");

        if (!user) {throw new AppError(Messages.SERVER_ERROR);}

        // Get the current session to preserve it and get role info
        const session = await this.authenticationTokenRepository.findById(currentTid, user.id);
        if (!session) {
            throw new AppError(Messages.SESSION_EXPIRED, "Active token session not found.");
        }

        // Update session expiry to extend it
        const newExpiredAt = this.dateUtil.expiredAt(
            Number(__ENV.JWT_EXPIRATION_DAYS || 7),
            "days",
        );
        await this.authenticationTokenRepository.update(currentTid, {expired_at: newExpiredAt});

        const role = await this.roleService.findById(user.role_id);

        // Generate a new JWT token with the same session ID (tid) and updated claims
        return this.tokenService.generateToken({
            uid: user.id,
            tid: currentTid,
            tfa,
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: user.authorization_version || 0,
        });
    }

    async password(user: User, data: SecurityAccountDTO, currentTid: number, tfa = false): Promise<string> {
        // verify the current password
        if (!user.password || !await this.securityUtil.compare(user.password, data.current_password)) {
            throw new AppError(Messages.CREDENTIAL_DO_NOT_MATCH);
        }

        // hashed if new password
        if (typeof data.new_password !== "undefined" && data.new_password !== null) {
            data.password = await this.securityUtil.hash(data.new_password);
        }

        // update the security details
        if (!await this.userRepository.update(user.id, data, "Activated")) {
            throw new AppError(Messages.UPDATE_FAILED);
        }

        // On password change, revoke all OTHER sessions but keep the current one
        // (rotate the current session for security)
        const newExpiredAt = this.dateUtil.expiredAt(
            Number(__ENV.JWT_EXPIRATION_DAYS || 7),
            "days",
        );

        // Create a new session for the current user
        const newSession = await this.authenticationTokenRepository.create({
            user_id: user.id,
            expired_at: newExpiredAt,
            ip: null,
            browser: null,
            os: null,
        });

        // Delete all OTHER sessions for this user (exclude the new session we just created)
        await this.authenticationTokenRepository.deleteAllByUserId(user.id, newSession.id);

        const role = await this.roleService.findById(user.role_id);

        // Update user object with new values for token
        if (typeof data.username !== "undefined") {user.username = data.username;}
        if (typeof data.email !== "undefined") {user.email = data.email;}
        if (typeof data.phone !== "undefined") {user.phone = data.phone;}

        // Generate a new JWT token with the new session ID
        return this.tokenService.generateToken({
            uid: user.id,
            tid: newSession.id,
            tfa: false,
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: user.authorization_version || 0,
        });
    }
}