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
import {OutboxRepository} from "../../jobs/outbox.repository";
import {OUTBOX_TYPES} from "../../jobs/outbox.interface";
import {VerificationService} from "../verification/verification.service";
import {resolveSender} from "../../system/settings/mail-settings";
import {__ENV} from "../../../config/environment";

const CODE_LENGTH = 6;
const CODE_EXPIRATION_MINUTES = 30;
const NEXT_RESEND_MINUTES = 2;

const MAX_TRIES = 5;
const NEXT_TRY_MINUTES = 3;

/**
 * Cooldown applied to unknown targets as well.
 *
 * Applying the same cooldown to every request keeps the response shape
 * and timing identical whether or not the account exists.
 */
const UNKNOWN_TARGET_COOLDOWN_MINUTES = NEXT_RESEND_MINUTES;

export class PasswordRecoveryService {
    constructor(
        private readonly securityUtil: SecurityUtil,
        private readonly recoveryRepository: PasswordRecoveryRepository,
        private readonly userRepository: UserRepository,
        private readonly settingService: SettingService,
        private readonly mailService: MailService,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly dateUtil: DateUtil,
        private readonly outboxRepository: OutboxRepository,
        private readonly verificationService: VerificationService,
    ) {
    }

    /**
     * Sends a password recovery code.
     *
     * The response shape and status are identical for known and unknown
     * targets, and the same cooldown applies to both. The database work
     * happens in a transaction; the email is dispatched through the
     * outbox so no network call ever happens inside a transaction.
     */
    async sendRecoveryCode(
        type: Type,
        sendTo: string,
    ): Promise<PasswordRecoveryResult> {
        const user = await this.findUser(type, sendTo);

        const now = new Date();

        if (!user) {
            /*
             * Simulate the cost of hashing a code so the response time
             * does not reveal whether the account exists.
             */
            await this.securityUtil.compare(
                "$2b$12$00000000000000000000000000000000000000000000000000000",
                sendTo,
            );

            return {
                sent: true,
                nextResendAt: this.addMinutes(
                    now,
                    UNKNOWN_TARGET_COOLDOWN_MINUTES,
                ),
            };
        }

        /*
         * Recovery through an unverified channel would let an attacker
         * who controls an unverified address take over the account.
         */
        const policy = await this.verificationService.getPolicy();

        if (policy.requiredForRecovery && type === RECOVERY_EMAIL) {
            const verified =
                await this.verificationService.isTargetVerified(
                    user.id,
                    "email",
                    sendTo,
                );

            if (!verified) {
                /*
                 * The response is intentionally identical to the
                 * success case so the endpoint cannot be used to probe
                 * which addresses are verified.
                 */
                return {
                    sent: true,
                    nextResendAt: this.addMinutes(
                        now,
                        UNKNOWN_TARGET_COOLDOWN_MINUTES,
                    ),
                };
            }
        }

        const existingRecovery =
            await this.recoveryRepository.findBySendTo(sendTo, type);

        this.assertResendAllowed(existingRecovery, now);

        const rawCode = this.securityUtil.randomNumber(CODE_LENGTH);
        const hashedCode = await this.securityUtil.hash(rawCode);

        const nextResendAt = this.addMinutes(now, NEXT_RESEND_MINUTES);
        const expiredAt = this.addMinutes(now, CODE_EXPIRATION_MINUTES);

        const recoveryData: PasswordRecoveryCreateData = {
            type,
            send_to: sendTo,
            code: hashedCode,
            next_resend_at: nextResendAt,
            expired_at: expiredAt,
            tries: 0,
            next_try_at: null,
            user_id: user.id,
        };

        /*
         * The transaction only handles the database operations.
         */
        await this.recoveryRepository.withTransaction(async (trx) => {
            if (existingRecovery) {
                await this.recoveryRepository.deleteById(
                    existingRecovery.id,
                    trx,
                );
            }

            await this.recoveryRepository.create(recoveryData, trx);
        });

        /*
         * The notification is queued, not sent inline: the request must
         * not wait on (or fail because of) the mail provider.
         */
        await this.queueRecoveryNotification(type, sendTo, rawCode);

        return {
            sent: true,
            nextResendAt,
        };
    }

    /**
     * Validates the recovery code and changes the user's password.
     *
     * The password update, the recovery-row deletion and the session
     * revocation all happen in a single transaction, so a failure never
     * leaves partial state and a reset always invalidates existing
     * sessions.
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

        const isValid = await this.securityUtil.compare(recovery.code, code);

        if (!isValid) {
            await this.registerFailedAttempt(recovery.id, recovery.tries, now);

            throw new AppError(
                Messages.INVALID_CODE,
                "Invalid recovery code.",
            );
        }

        const user = await this.findUser(type, sendTo);

        if (!user) {
            await this.recoveryRepository.deleteById(recovery.id);

            throw new AppError(
                Messages.USER_NOT_FOUND,
                "User account no longer exists.",
            );
        }

        const hashedPassword = await this.securityUtil.hash(newPassword);

        /*
         * All operations happen in a single transaction:
         * 1. Update the password
         * 2. Delete the recovery record
         * 3. Revoke all sessions
         * 4. Reset the lockout counters
         */
        await this.recoveryRepository.withTransaction(async (trx) => {
            await this.userRepository.updatePassword(
                user.id,
                hashedPassword,
                trx,
            );

            await this.recoveryRepository.deleteById(recovery.id, trx);

            // Revoke all sessions for this user
            await this.authenticationTokenRepository.deleteAllByUserId(
                user.id,
                undefined,
                trx,
            );

            // Reset the lockout counters so the user is not locked out
            await this.userRepository.update(
                user.id,
                {
                    login_tries: 0,
                    failed_login_expired_at: null,
                },
                undefined,
                trx,
            );
        });

        // Notify the user outside the transaction.
        await this.sendPasswordChangedNotification(type, sendTo);
    }

    private async findUser(type: Type, sendTo: string) {
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
            new Date(recovery.next_resend_at).getTime() > now.getTime()
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

        await this.recoveryRepository.updateTries(recoveryId, tries, null);
    }

    private isExpired(expiresAt: Date | string, now: Date): boolean {
        return new Date(expiresAt).getTime() <= now.getTime();
    }

    private addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60 * 1000);
    }

    /**
     * Queues the recovery email for delivery.
     *
     * The phone channel is explicitly unavailable: claiming success
     * without delivering anything would leave the user waiting for a
     * code that never arrives.
     */
    private async queueRecoveryNotification(
        type: Type,
        sendTo: string,
        plainCode: string,
    ): Promise<void> {
        if (type === RECOVERY_PHONE) {
            throw new AppError(
                Messages.INVALID_RECOVERY_TYPE,
                "Phone recovery channel is not available. Please use email recovery.",
            );
        }

        if (!__ENV.EMAIL_ENABLED) {
            return;
        }

        const settings = await this.settingService.getCache();
        const emailSettings = settings.pri;

        await this.outboxRepository.enqueue({
            type: OUTBOX_TYPES.SEND_EMAIL,
            payload: {
                to: sendTo,
                from: resolveSender(emailSettings, "psr_eml_snd"),
                subject: emailSettings.psr_eml_sbj,
                text: `Recovery Code: ${plainCode}`,
            },
        });
    }

    private async sendPasswordChangedNotification(
        type: Type,
        sendTo: string,
    ): Promise<void> {
        if (type !== RECOVERY_EMAIL || !__ENV.EMAIL_ENABLED) {
            return;
        }

        const settings = await this.settingService.getCache();
        const emailSettings = settings.pri;

        await this.outboxRepository.enqueue({
            type: OUTBOX_TYPES.SEND_EMAIL,
            payload: {
                to: sendTo,
                from: resolveSender(emailSettings, "psr_eml_snd"),
                subject: emailSettings.psr_eml_sbj,
                text: "Your password has been successfully reset. If you didn't make this change, please contact support.",
            },
        });
    }
}
