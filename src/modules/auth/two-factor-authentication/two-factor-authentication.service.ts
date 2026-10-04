// src/modules/auth/two-factor-authentication/two-factor-authentication.service.ts
import {TwoFactorAuthenticationRepository} from "./two-factor-authentication.repository";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {TokenService} from "../authentication/authentication-token.service";
import {AuthenticationTokenRepository} from "../authentication/authentication-token.repository";
import {SettingService} from "../../system/settings/setting.service";
import {MailService} from "../../../common/interfaces/mail.interface";
import {
    SendOtpInput,
    SendOtpResult,
    VerifyOtpInput,
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

        return this.authTokenService.generateToken({
            uid: input.user.id,
            tid: input.tokenId,
            tfa: true,
        });
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
}
