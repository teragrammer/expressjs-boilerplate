// src/modules/auth/verification/verification.service.ts
import {createHash, randomBytes} from "node:crypto";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {MailService} from "../../../common/interfaces/mail.interface";
import {SettingService} from "../../system/settings/setting.service";
import {UserRepository} from "../../users/user.repository";
import {OutboxRepository} from "../../jobs/outbox.repository";
import {OUTBOX_TYPES} from "../../jobs/outbox.interface";
import {VerificationRepository} from "./verification.repository";
import {
    SendVerificationResult,
    VerificationChannel,
    VerificationPolicy,
} from "./verification.interface";

/**
 * Verification tokens are high-entropy random values.
 *
 * They are hashed with SHA-256 rather than bcrypt: the token has 256
 * bits of entropy, so a slow KDF adds latency without adding security.
 */
const TOKEN_BYTES = 32;

export class VerificationService {
    constructor(
        private readonly securityUtil: SecurityUtil,
        private readonly verificationRepository: VerificationRepository,
        private readonly userRepository: UserRepository,
        private readonly settingService: SettingService,
        private readonly outboxRepository: OutboxRepository,
        private readonly mailService: MailService,
        private readonly dateUtil: DateUtil,
    ) {
    }

    /**
     * Resolves the verification policy from the settings cache.
     */
    async getPolicy(): Promise<VerificationPolicy> {
        const settings = await this.settingService.getCache();

        const requiredForRecovery = Number(
            settings.pri?.ver_req_rcv ?? 0,
        );

        return {
            emailTtlHours: Number(settings.pri?.ver_eml_ttl ?? 24),
            phoneTtlMinutes: Number(settings.pri?.ver_phn_ttl ?? 10),
            maxAttempts: Number(settings.pri?.ver_max_try ?? 5),
            requiredForRecovery: requiredForRecovery === 1,
        };
    }

    /**
     * Hashes a verification token for storage.
     */
    private hashToken(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }

    /**
     * Issues a verification token for a user/channel target.
     *
     * The plain token is delivered through the outbox so it is never
     * sent inside a database transaction, and any previously issued
     * token for the same channel is invalidated.
     */
    async send(
        userId: number,
        channel: VerificationChannel,
        target: string,
    ): Promise<SendVerificationResult> {
        const policy = await this.getPolicy();

        const expiresAt =
            channel === "email"
                ? this.dateUtil.expiredAt(policy.emailTtlHours, "hours")
                : this.dateUtil.expiredAt(policy.phoneTtlMinutes, "minutes");

        const plainToken = randomBytes(TOKEN_BYTES).toString("base64url");

        await this.verificationRepository.invalidateForUserChannel(
            userId,
            channel,
        );

        await this.verificationRepository.create({
            user_id: userId,
            channel,
            target,
            token_hash: this.hashToken(plainToken),
            expires_at: expiresAt,
        });

        if (channel === "email") {
            const settings = await this.settingService.getCache();

            /*
             * The email is dispatched by the outbox worker, so a slow
             * provider never blocks the request or holds a transaction.
             */
            await this.outboxRepository.enqueue({
                type: OUTBOX_TYPES.SEND_EMAIL,
                payload: {
                    to: target,
                    from: settings.pri.ver_eml_snd,
                    subject: settings.pri.ver_eml_sbj,
                    text: `Your verification code is: ${plainToken}`,
                },
            });
        }

        return {sent: true, expiresAt};
    }

    /**
     * Confirms a verification token and flips the matching flag.
     */
    async confirm(
        userId: number,
        token: string,
    ): Promise<{verified: true; channel: VerificationChannel}> {
        const stored = await this.verificationRepository.findByHash(
            this.hashToken(token),
        );

        if (!stored || stored.user_id !== userId) {
            throw new AppError(
                Messages.INVALID_TOKEN,
                "The verification link is invalid or has expired.",
            );
        }

        if (stored.consumed_at) {
            throw new AppError(
                Messages.INVALID_TOKEN,
                "The verification link has already been used.",
            );
        }

        if (new Date(stored.expires_at).getTime() <= Date.now()) {
            throw new AppError(
                Messages.EXPIRED_TOKEN,
                "The verification link has expired. Please request a new one.",
            );
        }

        const policy = await this.getPolicy();

        if (stored.attempts >= policy.maxAttempts) {
            throw new AppError(
                Messages.TOO_MANY_ATTEMPTS,
                "Too many verification attempts. Please request a new code.",
            );
        }

        await this.verificationRepository.consume(stored.id);

        if (stored.channel === "email") {
            await this.userRepository.update(userId, {
                is_email_verified: true,
            });
        } else {
            await this.userRepository.update(userId, {
                is_phone_verified: true,
            });
        }

        return {verified: true, channel: stored.channel};
    }

    /**
     * Checks whether a contact target has been verified for a user.
     *
     * Used by the recovery flow to refuse recovery through an
     * unverified channel.
     */
    async isTargetVerified(
        userId: number,
        channel: VerificationChannel,
        target: string,
    ): Promise<boolean> {
        return this.verificationRepository.isTargetVerified(
            userId,
            channel,
            target,
        );
    }

    /**
     * Resets the verification flag for a channel.
     *
     * Called when the contact value changes so the new target must be
     * verified before it can be used for recovery.
     */
    async resetFlag(
        userId: number,
        channel: VerificationChannel,
    ): Promise<void> {
        await this.verificationRepository.invalidateForUserChannel(
            userId,
            channel,
        );

        if (channel === "email") {
            await this.userRepository.update(userId, {
                is_email_verified: false,
            });
        } else {
            await this.userRepository.update(userId, {
                is_phone_verified: false,
            });
        }
    }
}
