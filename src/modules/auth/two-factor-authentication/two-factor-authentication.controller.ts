// src/modules/auth/two-factor-authentication/two-factor-authentication.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {TwoFactorAuthenticationService} from "./two-factor-authentication.service";
import {assertCredentials} from "../../../common/utils/request-credentials";
import {User} from "../../users/user.interface";
import {getClientIp, getUserAgentInfo} from "../../../common/utils/request-info";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";

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

    validate = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const {jwt} = req.credentials;

        const user: User = await req.credentials.user();

        /*
         * The code comes from the validated payload, never straight
         * from the request body.
         */
        const {code} = req.sanitize.data as {code: string};

        const token = await this.tfaService.verifyOtp({
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

        await this.auditService.success(AUDIT_ACTIONS.AUTH_TFA_VERIFIED, {
            request: req,
        });

        res.status(200).json({token});
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
}
