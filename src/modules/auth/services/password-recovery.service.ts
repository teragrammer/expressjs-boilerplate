// src/modules/auth/services/password-recovery.service.ts
import {UserRepository} from "../../users/user.repository";
import {PasswordRecoveryCreateData, PasswordRecoveryRepository,} from "../repositories/password-recovery.repository";
import {RECOVERY_EMAIL, RECOVERY_PHONE, Type,} from "../interfaces/password.recovery.interface";
import {SecurityUtil} from "../../../common/utils/security.util";
import {AppError} from "../../../common/utils/errors";
import {__ENV} from "../../../config/environment";
import Messages from "../../../common/utils/messages";
import {SettingService} from "../../system/settings/setting.service";
import {MailService} from "../../../common/interfaces/mail.interface";

const CODE_LENGTH = 6;
const CODE_EXPIRATION_MINUTES = 30;
const NEXT_RESEND_MINUTES = 2;

const MAX_TRIES = 5;
const NEXT_TRY_MINUTES = 3;

export interface PasswordRecoveryResult {
    sent: boolean;
    nextResendAt?: Date;
}

const defaultSecurityUtil = new SecurityUtil({
    bcryptSecret: __ENV.BCRYPT_SECRET,
    bcryptSaltRounds: Number(__ENV.BCRYPT_SALT_ROUND || 10),
    cryptoSecret: __ENV.CRYPT0_SECRET,
    cryptoCipher: __ENV.CRYPT0_CIPHER,
});

export class PasswordRecoveryService {
    constructor(
        private readonly securityUtil: SecurityUtil = defaultSecurityUtil,
        private readonly recoveryRepository: PasswordRecoveryRepository =
        new PasswordRecoveryRepository(),
        private readonly userRepository: UserRepository =
        new UserRepository(),
        private readonly settingService: SettingService,
        private readonly mailService: MailService,
    ) {
    }

    /**
     * Sends a password recovery code.
     *
     * The recovery record and notification are treated as one workflow:
     *
     * 1. Resolve account.
     * 2. Check resend cooldown.
     * 3. Generate and persist hashed recovery code.
     * 4. Send notification.
     * 5. Commit transaction.
     *
     * If notification delivery throws, the transaction is rolled back.
     */
    async sendRecoveryCode(
        type: Type,
        sendTo: string,
    ): Promise<PasswordRecoveryResult> {
        const user = await this.findUser(type, sendTo);

        /*
         * Do not reveal whether the account exists.
         */
        if (!user) {
            return {sent: true};
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
         * The mail operation intentionally occurs inside the transaction.
         *
         * If MailService throws, Knex rolls back the inserted recovery
         * record automatically.
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

            await this.sendRecoveryNotification(
                type,
                sendTo,
                rawCode,
            );
        });

        return {
            sent: true,
            nextResendAt,
        };
    }

    /**
     * Validates the recovery code and changes the user's password.
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
         * Password update and recovery invalidation should happen
         * atomically.
         */
        await this.userRepository.updatePassword(
            user.id,
            hashedPassword,
        );

        const deleted =
            await this.recoveryRepository.deleteById(recovery.id);

        if (!deleted) {
            /*
             * At this point the password has already changed.
             *
             * This is why the final implementation should move these
             * two operations into a shared transaction/unit-of-work.
             */
            throw new AppError(
                Messages.RECOVERY_COMPLETION_FAILED,
                "Unable to complete password recovery.",
            );
        }
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
                 * SMS provider can be added here without changing
                 * controller/API behavior.
                 */
                return;
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
}
