// src/modules/users/services/account.service.ts
import {SecurityAccountDTO, UpdateUserDTO, User} from "../user.interface";
import {UserRepository} from "../user.repository";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {SecurityUtil} from "../../../common/utils/security.util";
import {AuthenticationTokenRepository} from "../../auth/authentication/authentication-token.repository";
import {RoleService} from "../../system/roles/role.service";
import {DateUtil} from "../../../common/utils/date.util";
import {SessionService} from "../../auth/authentication/session.service";
import {VerificationService} from "../../auth/verification/verification.service";
import {PasswordRecoveryRepository} from "../../auth/password-recovery/password-recovery.repository";
import {__ENV} from "../../../config/environment";

export class AccountService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly securityUtil: SecurityUtil,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly roleService: RoleService,
        private readonly dateUtil: DateUtil,
        private readonly sessionService: SessionService,
        private readonly verificationService: VerificationService,
        private readonly passwordRecoveryRepository: PasswordRecoveryRepository,
    ) {
    }

    /**
     * Updates the caller's profile fields.
     *
     * The current session is preserved and a fresh access token is
     * issued against it, so the caller never receives a token that
     * bypasses the session check.
     */
    async information(
        id: number,
        data: UpdateUserDTO,
        currentTid: number,
        tfa = false,
    ): Promise<string> {
        /*
         * The current contact values are read before the update so a
         * changed email/phone can be detected: the repository returns
         * the *updated* row, which would otherwise look unchanged.
         */
        const previous = await this.userRepository.findAuthById(id);

        const user: User | null = await this.userRepository.update(
            id,
            data,
            "Activated",
        );

        if (!user) {
            throw new AppError(Messages.SERVER_ERROR);
        }

        /*
         * A changed email or phone must be re-verified before it can be
         * used, so the verification flag is reset and the pending value
         * is sent for verification.
         */
        await this.handleContactChange(previous, user, data);

        // Keep the current session alive and refresh its expiry.
        const newExpiredAt = this.dateUtil.expiredAt(
            Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7),
            "days",
        );

        await this.authenticationTokenRepository.update(currentTid, {
            expired_at: newExpiredAt,
        });

        const role = await this.roleService.findById(user.role_id);

        const issued = await this.sessionService.issueForSession(
            currentTid,
            user,
            role,
            tfa,
        );

        return issued.accessToken;
    }

    /**
     * Changes the caller's credentials.
     *
     * Every other session is revoked, the current session is rotated to
     * a new session id, and outstanding recovery codes are invalidated
     * so a stale recovery token cannot be used afterwards.
     */
    async password(
        user: User,
        data: SecurityAccountDTO,
        currentTid: number,
        tfa = false,
    ): Promise<string> {
        // verify the current password
        if (
            !user.password ||
            !await this.securityUtil.compare(user.password, data.current_password)
        ) {
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

        /*
         * Invalidate outstanding recovery codes: a password change means
         * any recovery code issued earlier must not be redeemable.
         */
        await this.passwordRecoveryRepository.deleteAllByUserId(user.id);

        /*
         * Rotate the current session and revoke every other session for
         * the user. The caller receives a token bound to the new session.
         */
        const newSession = await this.authenticationTokenRepository.create({
            user_id: user.id,
            expired_at: this.dateUtil.expiredAt(
                Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7),
                "days",
            ),
            ip: null,
            browser: null,
            os: null,
        });

        await this.authenticationTokenRepository.deleteAllByUserId(
            user.id,
            newSession.id,
        );

        // Update user object with new values for token
        if (typeof data.username !== "undefined") {user.username = data.username;}
        if (typeof data.email !== "undefined") {user.email = data.email;}
        if (typeof data.phone !== "undefined") {user.phone = data.phone;}

        const role = await this.roleService.findById(user.role_id);

        const issued = await this.sessionService.issueForSession(
            newSession.id,
            user,
            role,
            tfa,
            {includeRefreshToken: true},
        );

        return issued.accessToken;
    }

    /**
     * Resets verification flags and schedules verification for a
     * changed contact value.
     */
    private async handleContactChange(
        previous: User | null,
        updated: User,
        data: UpdateUserDTO,
    ): Promise<void> {
        const previousEmail = previous?.email ?? null;
        const previousPhone = previous?.phone ?? null;

        if (
            typeof data.email !== "undefined" &&
            data.email !== null &&
            data.email !== "" &&
            data.email !== previousEmail
        ) {
            await this.verificationService.resetFlag(updated.id, "email");
            await this.verificationService.send(
                updated.id,
                "email",
                data.email,
            );
        }

        if (
            typeof data.phone !== "undefined" &&
            data.phone !== null &&
            data.phone !== "" &&
            data.phone !== previousPhone
        ) {
            await this.verificationService.resetFlag(updated.id, "phone");
            await this.verificationService.send(
                updated.id,
                "phone",
                data.phone,
            );
        }
    }
}
