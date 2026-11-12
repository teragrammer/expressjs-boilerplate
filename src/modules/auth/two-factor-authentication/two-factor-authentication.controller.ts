// src/modules/auth/two-factor-authentication/two-factor-authentication.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {TwoFactorAuthenticationService} from "./two-factor-authentication.service";
import {assertCredentials} from "../../../common/utils/request-credentials";
import {User} from "../../users/user.interface";
import {getClientIp, getUserAgentInfo} from "../../../common/utils/request-info";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";
import {setRefreshTokenCookie} from "../../../common/utils/refresh-token-cookie";
import {__ENV} from "../../../config/environment";
import {IssuedTokens} from "../authentication/session.service";

const REFRESH_COOKIE_MAX_AGE_MS =
    Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7) * 24 * 60 * 60 * 1000;

export class TwoFactorAuthenticationController {
    constructor(
        private readonly tfaService: TwoFactorAuthenticationService,
        private readonly auditService: AuditService,
    ) {
    }

    send = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const {jwt} = req.credentials;
        const user: User = await req.credentials.user();

        const result = await this.tfaService.sendOtp({
            tokenId: jwt.tid,
            email: user.email || undefined,
            tfaCleared: jwt.tfa,
        });

        res.status(200).json({
            id: result.id,
            next_try: result.nextTry,
        });
    });

    /**
     * Sends the enrollment OTP.
     *
     * Unlike the login challenge, this endpoint is used by an already
     * authenticated user who does not have TFA enabled yet.
     */
    enrollSend = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const {jwt} = req.credentials;
        const user: User = await req.credentials.user();

        const result = await this.tfaService.sendEnrollmentOtp({
            userId: user.id,
            tokenId: jwt.tid,
            email: user.email || undefined,
        });

        res.status(200).json({
            id: result.id,
            next_try: result.nextTry,
        });
    });

    validate = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const {jwt} = req.credentials;

        const user: User = await req.credentials.user();

        /*
         * The code comes from the validated payload, never straight
         * from the request body.
         */
        const {code} = req.sanitize.data as {code: string};

        const issued = await this.tfaService.verifyOtp({
            tokenId: jwt.tid,
            code,
            user,
            meta: {
                ip: getClientIp(req),
                browser: req.useragent?.browser ?? null,
                os: req.useragent?.os ?? null,
            },
            tfaCleared: jwt.tfa,
        });

        this.attachRefreshToken(res, issued);

        await this.auditService.success(AUDIT_ACTIONS.AUTH_TFA_VERIFIED, {
            request: req,
        });

        res.status(200).json({
            token: issued.accessToken,
            access_token: issued.accessToken,
            expires_at: issued.expiresAt,
        });
    });

    /**
     * Redeems a single-use recovery code when the second factor is
     * unavailable.
     */
    recovery = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const {jwt} = req.credentials;
        const user: User = await req.credentials.user();

        const {code} = req.sanitize.data as {code: string};

        const issued = await this.tfaService.redeemRecoveryCode({
            userId: user.id,
            sessionId: jwt.tid,
            code,
            meta: {
                ip: getClientIp(req),
                browser: req.useragent?.browser ?? null,
                os: req.useragent?.os ?? null,
            },
        });

        this.attachRefreshToken(res, issued);

        await this.auditService.success(
            AUDIT_ACTIONS.AUTH_TFA_RECOVERY_CODE_USED,
            {request: req},
        );

        res.status(200).json({
            token: issued.accessToken,
            access_token: issued.accessToken,
            expires_at: issued.expiresAt,
        });
    });

    enroll = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const {jwt} = req.credentials;
        const user: User = await req.credentials.user();

        const {code} = req.sanitize.data as {code: string};

        const result = await this.tfaService.enrollTfa({
            userId: user.id,
            tokenId: jwt.tid,
            code,
        });

        await this.auditService.success(AUDIT_ACTIONS.AUTH_TFA_ENABLED, {
            request: req,
        });

        if (result.enrolled && result.recoveryCodes) {
            res.status(200).json({
                enrolled: true,
                message: "Two-factor authentication enabled successfully. Save your recovery codes.",
                recovery_codes: result.recoveryCodes,
            });
        } else {
            res.status(200).json({enrolled: false});
        }
    });

    disable = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const user: User = await req.credentials.user();

        const {password} = req.sanitize.data as {password: string};

        await this.tfaService.disableTfa(user.id, password);

        await this.auditService.success(AUDIT_ACTIONS.AUTH_TFA_DISABLED, {
            request: req,
        });

        res.status(200).json({
            disabled: true,
            message: "Two-factor authentication disabled successfully.",
        });
    });

    private attachRefreshToken(res: Response, issued: IssuedTokens): void {
        if (!issued.refreshToken) {
            return;
        }

        setRefreshTokenCookie(
            res,
            issued.refreshToken,
            REFRESH_COOKIE_MAX_AGE_MS,
        );
    }
}
