// src/modules/auth/two-factor-authentication/two-factor-authentication.service.ts
import {TwoFactorAuthenticationRepository} from "./two-factor-authentication.repository";
import {TfaRecoveryCodeRepository} from "./tfa-recovery-code.repository";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {AuthenticationTokenRepository} from "../authentication/authentication-token.repository";
import {SessionService, IssuedTokens} from "../authentication/session.service";
import {SettingService} from "../../system/settings/setting.service";
import {RoleService} from "../../system/roles/role.service";
import {UserRepository} from "../../users/user.repository";
import {User} from "../../users/user.interface";
import {MailService} from "../../../common/interfaces/mail.interface";
import {withTransaction} from "../../../config/database";
import {
    SendOtpInput,
    SendOtpResult,
    VerifyOtpInput,
    EnrollTfaInput,
    EnrollTfaResult,
    RedeemRecoveryCodeInput,
    SendEnrollmentOtpInput,
    TfaPolicy,
} from "./two-factor-authentication.interface";

/**
 * Maximum failed OTP attempts before a temporary lockout.
 */
const MAX_OTP_TRIES = 5;

/**
 * Duration of an OTP attempt lockout.
 */
const OTP_LOCKOUT_MINUTES = 15;

export class TwoFactorAuthenticationService {
    constructor(
        private readonly securityUtil: SecurityUtil,
        private readonly tfaRepository: TwoFactorAuthenticationRepository,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly dateUtil: DateUtil,
        private readonly settingService: SettingService,
        private readonly mailService: MailService,
        private readonly roleService: RoleService,
        private readonly userRepository: UserRepository,
        private readonly sessionService: SessionService,
        private readonly recoveryCodeRepository: TfaRecoveryCodeRepository,
    ) {
    }

    /**
     * Sends the OTP that completes a pending login challenge.
     */
    public async sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
        this.assertOtpRequired(input.tfaCleared);
        this.assertEmailConfigured(input.email);

        const {id, nextTry, plainCode} = await this.generateOtp(input.tokenId);

        await this.sendOtpEmail(input.email!, plainCode);

        return {
            id,
            nextTry,
        };
    }

    /**
     * Sends the OTP used to enroll an authenticated user in TFA.
     *
     * Enrollment is intentionally a separate entry point: a user who
     * already holds a fully authenticated session (`tfa: true`) must
     * still be able to turn the second factor on.
     */
    public async sendEnrollmentOtp(
        input: SendEnrollmentOtpInput,
    ): Promise<SendOtpResult> {
        this.assertEmailConfigured(input.email);

        const user = await this.userRepository.findAuthById(input.userId);

        if (!user) {
            throw new AppError(Messages.USER_NOT_FOUND);
        }

        if (user.has_tfa) {
            throw new AppError(
                Messages.INVALID_REQUEST,
                "Two-factor authentication is already enabled.",
            );
        }

        const {id, nextTry, plainCode} = await this.generateOtp(input.tokenId);

        await this.sendOtpEmail(input.email!, plainCode);

        return {
            id,
            nextTry,
        };
    }

    /**
     * Verifies a login OTP and upgrades the session.
     *
     * A new credential pair is issued so the client keeps a usable
     * refresh token; the session row is marked as TFA-verified, which
     * is the durable state refresh rotation reads.
     */
    public async verifyOtp(input: VerifyOtpInput): Promise<IssuedTokens> {
        this.assertOtpRequired(input.tfaCleared);

        const tfa = await this.assertValidOtp(input.tokenId, input.code);

        const consumed = await this.tfaRepository.deleteById(tfa.id);

        if (!consumed) {
            throw new AppError(Messages.INVALID_CODE);
        }

        await this.authenticationTokenRepository.markTfaVerified(
            input.tokenId,
        );

        await this.authenticationTokenRepository
            .purgeExpiredTokensByUserId(input.user.id);

        const role = await this.roleService.findById(input.user.role_id);

        return this.sessionService.issueForSession(
            input.tokenId,
            input.user,
            role,
            true,
            {
                includeRefreshToken: true,
                metadata: input.meta,
            },
        );
    }

    /**
     * Enrolls a user in TFA by verifying an OTP and setting has_tfa = true.
     * Generates single-use recovery codes for the user.
     */
    public async enrollTfa(input: EnrollTfaInput): Promise<EnrollTfaResult> {
        const user = await this.userRepository.findAuthById(input.userId);

        if (!user) {
            throw new AppError(Messages.USER_NOT_FOUND);
        }

        if (user.has_tfa) {
            throw new AppError(
                Messages.INVALID_REQUEST,
                "Two-factor authentication is already enabled.",
            );
        }

        const tfa = await this.assertValidOtp(input.tokenId, input.code);

        const recoveryCodes = this.generateRecoveryCodes(8);

        const hashedRecoveryCodes = await Promise.all(
            recoveryCodes.map((code) => this.securityUtil.hash(code)),
        );

        /*
         * Enabling TFA and storing the recovery codes must be atomic:
         * a failure must not leave the account marked as enrolled
         * without any way to recover it.
         */
        await withTransaction(async (trx) => {
            const consumed = await this.tfaRepository.deleteById(
                tfa.id,
                trx,
            );

            if (!consumed) {
                throw new AppError(Messages.INVALID_CODE);
            }

            const updated = await this.userRepository.update(
                input.userId,
                {
                    has_tfa: true,
                    tfa_secret: null,
                },
                undefined,
                trx,
            );

            if (!updated) {
                throw new AppError(Messages.UPDATE_FAILED);
            }

            await this.recoveryCodeRepository.deleteAllByUserId(
                input.userId,
                trx,
            );

            await this.recoveryCodeRepository.createMany(
                input.userId,
                hashedRecoveryCodes,
                trx,
            );
        });

        await this.authenticationTokenRepository
            .purgeExpiredTokensByUserId(input.userId);

        return {
            enrolled: true,
            recoveryCodes,
        };
    }

    /**
     * Redeems a one-time recovery code when the authenticator or email
     * is unavailable.
     *
     * The code is deleted on success and the session is upgraded, so a
     * recovery code cannot be replayed.
     */
    public async redeemRecoveryCode(
        input: RedeemRecoveryCodeInput,
    ): Promise<IssuedTokens> {
        const user = await this.userRepository.findAuthById(input.userId);

        if (!user) {
            throw new AppError(Messages.USER_NOT_FOUND);
        }

        if (!user.has_tfa) {
            throw new AppError(
                Messages.INVALID_REQUEST,
                "Two-factor authentication is not enabled.",
            );
        }

        const normalizedCode = input.code.trim().toUpperCase();
        const candidates = await this.recoveryCodeRepository.findByUserId(
            input.userId,
        );

        let matchedId: number | null = null;

        for (const candidate of candidates) {
            if (
                await this.securityUtil.compare(
                    candidate.code_hash,
                    normalizedCode,
                )
            ) {
                matchedId = candidate.id;
                break;
            }
        }

        if (matchedId === null) {
            throw new AppError(Messages.INVALID_CODE);
        }

        await withTransaction(async (trx) => {
            const consumed = await this.recoveryCodeRepository.deleteById(
                matchedId!,
                trx,
            );

            if (!consumed) {
                throw new AppError(Messages.INVALID_CODE);
            }

            await this.authenticationTokenRepository.markTfaVerified(
                input.sessionId,
                trx,
            );
        });

        const role = await this.roleService.findById(user.role_id);

        return this.sessionService.issueForSession(
            input.sessionId,
            user,
            role,
            true,
            {
                includeRefreshToken: true,
                metadata: input.meta,
            },
        );
    }

    /**
     * Disables TFA for a user (requires password verification).
     */
    public async disableTfa(userId: number, password: string): Promise<void> {
        const user = await this.userRepository.findAuthById(userId);
        if (!user || !user.password) {
            throw new AppError(Messages.USER_NOT_FOUND);
        }

        const isPasswordMatch = await this.securityUtil.compare(
            user.password,
            password,
        );
        if (!isPasswordMatch) {
            throw new AppError(Messages.CREDENTIAL_DO_NOT_MATCH);
        }

        await withTransaction(async (trx) => {
            await this.userRepository.update(
                userId,
                {
                    has_tfa: false,
                    tfa_secret: null,
                },
                undefined,
                trx,
            );

            await this.recoveryCodeRepository.deleteAllByUserId(
                userId,
                trx,
            );
        });
    }

    /**
     * Gets the current TFA policy from settings.
     */
    public async getTfaPolicy(): Promise<TfaPolicy> {
        const settings = await this.settingService.getCache();
        const policyValue = settings.pri?.tta_policy as string | undefined;

        switch (policyValue) {
            case TfaPolicy.GLOBAL:
                return TfaPolicy.GLOBAL;
            case TfaPolicy.PER_USER:
                return TfaPolicy.PER_USER;
            default:
                return TfaPolicy.DISABLED;
        }
    }

    /**
     * Checks if TFA is required for a user based on policy.
     */
    public async isTfaRequired(user: User): Promise<boolean> {
        const policy = await this.getTfaPolicy();

        switch (policy) {
            case TfaPolicy.GLOBAL:
                return true;
            case TfaPolicy.PER_USER:
                return user.has_tfa === true;
            case TfaPolicy.DISABLED:
            default:
                return false;
        }
    }

    /**
     * Validates an OTP and applies a temporary lockout after repeated
     * failures. The row is returned but not deleted; callers decide
     * whether the consumption belongs to a larger transaction.
     */
    private async assertValidOtp(
        tokenId: number,
        code: string,
    ) {
        const tfa = await this.tfaRepository.findByTokenId(tokenId);

        if (!tfa) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        if (!tfa.expired_at) {
            throw new AppError(Messages.UN_CONFIGURED_EXPIRATION);
        }

        const currentTime = this.dateUtil.unix();
        const expiredAt = this.dateUtil.unix(new Date(tfa.expired_at));

        if (currentTime > expiredAt) {
            throw new AppError(Messages.RESOURCE_EXPIRED);
        }

        if (tfa.expired_tries_at) {
            const expiredTriesAt = this.dateUtil.unix(
                new Date(tfa.expired_tries_at),
            );

            if (expiredTriesAt > currentTime) {
                throw new AppError(Messages.TOO_MANY_ATTEMPTS);
            }

            await this.tfaRepository.resetTries(tfa.id);
            tfa.tries = 0;
        }

        if (tfa.tries >= MAX_OTP_TRIES) {
            await this.lockOtp(tfa.id);

            throw new AppError(Messages.TOO_MANY_ATTEMPTS);
        }

        const isCodeMatch = await this.securityUtil.compare(
            tfa.code,
            code,
        );

        if (!isCodeMatch) {
            await this.tfaRepository.incrementTries(tfa.id);

            /*
             * Set the lockout as soon as the limit is reached instead
             * of waiting for one more request: otherwise the last
             * failed attempt leaves the token in a state where the next
             * request only then starts the lockout.
             */
            if (tfa.tries + 1 >= MAX_OTP_TRIES) {
                await this.lockOtp(tfa.id);
            }

            throw new AppError(Messages.OTP_NO_MATCH);
        }

        return tfa;
    }

    private async lockOtp(id: number): Promise<void> {
        await this.tfaRepository.setExpiredTriesAt(
            id,
            this.dateUtil.expiredAt(OTP_LOCKOUT_MINUTES, "minutes"),
        );
    }

    private async generateOtp(tokenId: number): Promise<{
        id: number;
        nextTry: string;
        plainCode: string;
    }> {
        const nextTryDate = this.dateUtil.expiredAt(2, "minutes");

        const nextTry =
            nextTryDate instanceof Date
                ? nextTryDate.toISOString()
                : String(nextTryDate);

        const plainCode = String(this.securityUtil.randomNumber());
        const hashedCode = await this.securityUtil.hash(plainCode);
        const expiredAt = this.dateUtil.expiredAt(5, "minutes");

        const issuedOtp = await this.tfaRepository.issueOtp(tokenId, {
            code: hashedCode,
            expired_at: expiredAt,
            next_send_at: nextTry,
            created_at: this.dateUtil.sql(),
        });

        return {
            id: issuedOtp.id,
            nextTry,
            plainCode,
        };
    }

    private async sendOtpEmail(
        email: string,
        plainCode: string,
    ): Promise<void> {
        const settings = await this.settingService.getCache();
        const emailSettings = settings.pri;

        await this.mailService.send({
            to: email,
            from: emailSettings.tta_eml_snd,
            subject: emailSettings.tta_eml_sbj,
            text: `OTP Code: ${plainCode}`,
        });
    }

    private assertOtpRequired(tfaCleared: boolean): void {
        if (tfaCleared) {
            throw new AppError(Messages.OTP_NOT_NEEDED);
        }
    }

    private assertEmailConfigured(email?: string): asserts email is string {
        if (!email || email.trim() === "") {
            throw new AppError(Messages.UN_CONFIGURED_EMAIL);
        }
    }

    private generateRecoveryCodes(count: number): string[] {
        const codes: string[] = [];
        for (let i = 0; i < count; i++) {
            // Generate 8-character alphanumeric recovery codes
            const code = this.securityUtil.randomString(8).toUpperCase();
            codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
        }
        return codes;
    }
}
