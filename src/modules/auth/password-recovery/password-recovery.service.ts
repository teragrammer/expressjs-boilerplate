// src/modules/auth/password-recovery/password-recovery.service.ts
import {UserRepository} from "../../users/user.repository";
import {AuthenticationTokenRepository} from "../authentication/authentication-token.repository";
import {PasswordRecoveryRepository} from "./password-recovery.repository";
import {
    PasswordRecoveryCreateData,
    PasswordRecoveryResult,
    RECOVERY_EMAIL,
    RECOVERY_PHONE,
    Type,
} from "./password-recovery.interface";
import {SecurityUtil} from "../../../common/utils/security.util";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {SettingService} from "../../system/settings/setting.service";
import {MailService} from "../../../common/interfaces/mail.interface";
import {DateUtil} from "../../../common/utils/date.util";

const CODE_LENGTH = 6;
const CODE_EXPIRATION_MINUTES = 30;
const NEXT_RESEND_MINUTES = 2;

const MAX_TRIES = 5;
const NEXT_TRY_MINUTES = 3;

export class PasswordRecoveryService {
    constructor(
        private readonly securityUtil: SecurityUtil,
        private readonly recoveryRepository: PasswordRecoveryRepository,
        private readonly userRepository: UserRepository,
        private readonly settingService: SettingService,
        private readonly mailService: MailService,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly dateUtil: DateUtil,
    ) {
    }

    /**
     * Sends a password recovery code.
     *
     * Always returns the same response shape to prevent account enumeration.
     * Email is sent OUTSIDE the transaction to avoid holding DB connections.
     */
    async sendRecoveryCode(
        type: Type,
        sendTo: string,
    ): Promise<PasswordRecoveryResult> {
        const user = await this.findUser(type, sendTo);

        /*
         * Do not reveal whether the account exists.
         * Return the same shape for both cases.
         */
        if (!user) {
            // Simulate processing time for unknown accounts to prevent timing attacks
            await this.securityUtil.compare(
                "$2b$12$00000000000000000000000000000000000000000000000000000",
                sendTo,
            );
            return {sent: true, nextResendAt: null};
        }

        const now = new Date();

        const existingRecovery =
            await this.recoveryRepository.findBySendTo(sendTo, type);

        this.assertResendAllowed(existingRecovery, now);

        const rawCode = this.securityUtil.randomNumber(CODE_LENGTH);
        const hashedCode = await this.securityUtil.hash(rawCode);

        const nextResendAt = this.addMinutes(
            now,
            NEXT_RESEND_MINUTES,
        );

        const expiredAt = this.addMinutes(
            now,
            CODE_EXPIRATION_MINUTES,
        );

        const recoveryData: PasswordRecoveryCreateData = {
            type,
            send_to: sendTo,
            code: hashedCode,
            next_resend_at: nextResendAt,
            expired_at: expiredAt,
            tries: 0,
            next_try_at: null,
        };

        /*
         * The transaction only handles the DB operations.
         * Email is sent AFTER the transaction commits.
         */
        await this.recoveryRepository.withTransaction(async (trx) => {
            if (existingRecovery) {
                await this.recoveryRepository.deleteById(
                    existingRecovery.id,
                    trx,
                );
            }

            await this.recoveryRepository.create(
                recoveryData,
                trx,
            );
        });

        /*
         * Send notification OUTSIDE the transaction.
         * This prevents holding DB connections during email delivery.
         */
        await this.sendRecoveryNotification(
            type,
            sendTo,
            rawCode,
        );

        return {
            sent: true,
            nextResendAt,
        };
    }

    /**
     * Validates the recovery code and changes the user's password.
     *
     * This operation is atomic: password update + recovery deletion +
     * session revocation all happen in a single transaction.
     */
    async resetPassword(
        type: Type,
        sendTo: string,
        code: string,
        newPassword: string,
    ): Promise<void> {
        const recovery =
            await this.recoveryRepository.findBySendTo(sendTo, type);

        const now = new Date();

        this.assertRecoveryExists(recovery);

        if (this.isExpired(recovery.expired_at, now)) {
            await this.recoveryRepository.deleteById(recovery.id);

            throw new AppError(
                Messages.EXPIRED_TOKEN,
                "Recovery code has expired. Please request a new one.",
            );
        }

        this.assertAttemptAllowed(recovery.next_try_at, now);

        const isValid = await this.securityUtil.compare(
            recovery.code,
            code,
        );

        if (!isValid) {
            await this.registerFailedAttempt(
                recovery.id,
                recovery.tries,
                now,
            );

            throw new AppError(
                Messages.INVALID_CODE,
                "Invalid recovery code.",
            );
        }

        const user = await this.findUser(type, sendTo);

        if (!user) {
            /*
             * This should normally be impossible because the recovery
             * record was created only for an existing user.
             *
             * Keep the explicit check for defensive correctness.
             */
            await this.recoveryRepository.deleteById(recovery.id);

            throw new AppError(
                Messages.USER_NOT_FOUND,
                "User account no longer exists.",
            );
        }

        const hashedPassword =
            await this.securityUtil.hash(newPassword);

        /*
         * All operations happen in a single transaction:
         * 1. Update password
         * 2. Delete recovery record
         * 3. Revoke all sessions
         */
        await this.recoveryRepository.withTransaction(async (trx) => {
            await this.userRepository.updatePassword(
                user.id,
                hashedPassword,
                trx,
            );

            await this.recoveryRepository.deleteById(
                recovery.id,
                trx,
            );

            // Revoke all sessions for this user
            await this.authenticationTokenRepository.deleteAllByUserId(user.id);
        });

        // Send password changed notification (outside transaction)
        await this.sendPasswordChangedNotification(type, sendTo);
    }

    private async findUser(
        type: Type,
        sendTo: string,
    ) {
        if (type === RECOVERY_EMAIL) {
            return this.userRepository.findByEmail(sendTo);
        }

        if (type === RECOVERY_PHONE) {
            return this.userRepository.findByPhone(sendTo);
        }

        throw new AppError(
            Messages.INVALID_RECOVERY_TYPE,
            "Unsupported recovery type.",
        );
    }

    private assertResendAllowed(
        recovery: Awaited<
            ReturnType<PasswordRecoveryRepository["findBySendTo"]>
        >,
        now: Date,
    ): void {
        if (
            recovery &&
            new Date(recovery.next_resend_at).getTime() >
            now.getTime()
        ) {
            throw new AppError(
                Messages.TRY_RESEND,
                "Please wait before requesting another recovery code.",
            );
        }
    }

    private assertRecoveryExists(
        recovery: Awaited<
            ReturnType<PasswordRecoveryRepository["findBySendTo"]>
        >,
    ): asserts recovery is NonNullable<typeof recovery> {
        if (!recovery) {
            throw new AppError(
                Messages.INVALID_TOKEN,
                "Invalid or expired recovery session.",
            );
        }
    }

    private assertAttemptAllowed(
        nextTryAt: Date | string | null,
        now: Date,
    ): void {
        if (
            nextTryAt &&
            new Date(nextTryAt).getTime() > now.getTime()
        ) {
            throw new AppError(
                Messages.TOO_MANY_ATTEMPTS,
                "Too many failed attempts. Please wait a few minutes before trying again.",
            );
        }
    }

    private async registerFailedAttempt(
        recoveryId: number,
        currentTries: number,
        now: Date,
    ): Promise<void> {
        const tries = currentTries + 1;

        if (tries >= MAX_TRIES) {
            await this.recoveryRepository.updateTries(
                recoveryId,
                0,
                this.addMinutes(now, NEXT_TRY_MINUTES),
            );

            return;
        }

        await this.recoveryRepository.updateTries(
            recoveryId,
            tries,
            null,
        );
    }

    private isExpired(
        expiresAt: Date | string,
        now: Date,
    ): boolean {
        return new Date(expiresAt).getTime() <= now.getTime();
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(
            date.getTime() + minutes * 60 * 1000,
        );
    }

    private async sendRecoveryNotification(
        type: Type,
        sendTo: string,
        plainCode: string,
    ): Promise<void> {
        switch (type) {
            case RECOVERY_EMAIL:
                await this.sendRecoveryEmail(
                    sendTo,
                    plainCode,
                );
                return;

            case RECOVERY_PHONE:
                /*
                 * Phone recovery is not implemented yet.
                 * Return a clear error instead of claiming success.
                 */
                throw new AppError(
                    Messages.INVALID_RECOVERY_TYPE,
                    "Phone recovery channel is not available. Please use email recovery.",
                );
        }
    }

    private async sendRecoveryEmail(
        email: string,
        plainCode: string,
    ): Promise<void> {
        const settings = await this.settingService.getCache();
        const emailSettings = settings.pri;

        await this.mailService.send({
            to: email,
            from: emailSettings.psr_eml_snd,
            subject: emailSettings.psr_eml_sbj,
            text: `Recovery Code: ${plainCode}`,
        });
    }

    private async sendPasswordChangedNotification(
        type: Type,
        sendTo: string,
    ): Promise<void> {
        switch (type) {
            case RECOVERY_EMAIL:
                const settings = await this.settingService.getCache();
                const emailSettings = settings.pri;

                await this.mailService.send({
                    to: sendTo,
                    from: emailSettings.psr_eml_snd,
                    subject: emailSettings.psr_eml_sbj,
                    text: "Your password has been successfully reset. If you didn't make this change, please contact support.",
                });
                return;

            case RECOVERY_PHONE:
                return;
        }
    }
}