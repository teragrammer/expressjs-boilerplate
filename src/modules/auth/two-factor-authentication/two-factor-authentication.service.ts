// src/modules/auth/two-factor-authentication/two-factor-authentication.service.ts
import {TwoFactorAuthenticationRepository} from "./two-factor-authentication.repository";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {TokenService} from "../authentication/authentication-token.service";
import {AuthenticationTokenRepository} from "../authentication/authentication-token.repository";
import {SettingService} from "../../system/settings/setting.service";
import {RoleService} from "../../system/roles/role.service";
import {UserRepository} from "../../users/user.repository";
import {User} from "../../users/user.interface";
import {MailService} from "../../../common/interfaces/mail.interface";
import {
    SendOtpInput,
    SendOtpResult,
    VerifyOtpInput,
    EnrollTfaInput,
    EnrollTfaResult,
    TfaPolicy,
} from "./two-factor-authentication.interface";

export class TwoFactorAuthenticationService {
    constructor(
        private readonly securityUtil: SecurityUtil,
        private readonly tfaRepository: TwoFactorAuthenticationRepository,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly authTokenService: TokenService,
        private readonly dateUtil: DateUtil,
        private readonly settingService: SettingService,
        private readonly mailService: MailService,
        private readonly roleService: RoleService,
        private readonly userRepository: UserRepository,
    ) {
    }

    public async sendOtp(input: SendOtpInput): Promise<SendOtpResult> {
        this.assertOtpRequired(input.tfaCleared);
        this.assertEmailConfigured(input.email);

        // generate OTP code
        const {id, nextTry, plainCode} = await this.generateOtp(input.tokenId);

        // send email
        await this.sendOtpEmail(input.email!, plainCode);

        return {
            id,
            nextTry,
        };
    }

    public async verifyOtp(input: VerifyOtpInput): Promise<string> {
        this.assertOtpRequired(input.tfaCleared);

        const tfa = await this.tfaRepository.findByTokenId(input.tokenId);

        if (!tfa) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        if (!tfa.expired_at) {
            throw new AppError(Messages.UN_CONFIGURED_EXPIRATION);
        }

        const currentTime = this.dateUtil.unix();
        const expiredAt = this.dateUtil.unix(
            new Date(tfa.expired_at),
        );

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

        if (tfa.tries >= 5) {
            // Set expired_tries_at for lockout duration instead of permanent lockout
            const lockoutDuration = 15; // 15 minutes
            await this.tfaRepository.setExpiredTriesAt(
                tfa.id,
                this.dateUtil.expiredAt(lockoutDuration, "minutes"),
            );

            throw new AppError(Messages.TOO_MANY_ATTEMPTS,);
        }

        const isCodeMatch = await this.securityUtil.compare(
            tfa.code,
            input.code,
        );

        if (!isCodeMatch) {
            await this.tfaRepository.incrementTries(tfa.id);

            throw new AppError(Messages.OTP_NO_MATCH);
        }

        await this.tfaRepository.deleteById(tfa.id);

        await this.authenticationTokenRepository
            .purgeExpiredTokensByUserId(input.user.id);

        const role = await this.roleService.findById(input.user.role_id);

        return this.authTokenService.generateToken({
            uid: input.user.id,
            tid: input.tokenId,
            tfa: true,
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: input.user.authorization_version || 0,
        });
    }

    /**
     * Enrolls a user in TFA by verifying an OTP and setting has_tfa = true.
     * Generates recovery codes for the user.
     */
    public async enrollTfa(input: EnrollTfaInput): Promise<EnrollTfaResult> {
        const tfa = await this.tfaRepository.findByTokenId(input.tokenId);

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

        const isCodeMatch = await this.securityUtil.compare(tfa.code, input.code);

        if (!isCodeMatch) {
            await this.tfaRepository.incrementTries(tfa.id);
            throw new AppError(Messages.OTP_NO_MATCH);
        }

        // Generate recovery codes
        const recoveryCodes = this.generateRecoveryCodes(8);

        // Hash recovery codes for storage
        const hashedRecoveryCodes = await Promise.all(
            recoveryCodes.map(code => this.securityUtil.hash(code))
        );

        // Update user: set has_tfa = true and store hashed recovery codes
        await this.userRepository.update(input.userId, {
            has_tfa: true,
            tfa_secret: hashedRecoveryCodes.join(","),
        });

        // Delete the used OTP
        await this.tfaRepository.deleteById(tfa.id);

        // Purge expired tokens
        await this.authenticationTokenRepository.purgeExpiredTokensByUserId(input.userId);

        return {
            enrolled: true,
            recoveryCodes,
        };
    }

    /**
     * Disables TFA for a user (requires password verification).
     */
    public async disableTfa(userId: number, password: string): Promise<void> {
        const user = await this.userRepository.findAuthById(userId);
        if (!user || !user.password) {
            throw new AppError(Messages.USER_NOT_FOUND);
        }

        const isPasswordMatch = await this.securityUtil.compare(user.password, password);
        if (!isPasswordMatch) {
            throw new AppError(Messages.CREDENTIAL_DO_NOT_MATCH);
        }

        await this.userRepository.update(userId, {
            has_tfa: false,
            tfa_secret: null,
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
