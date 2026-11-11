// src/modules/auth/two-factor-authentication/two-factor-authentication.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {TwoFactorAuthenticationService} from "./two-factor-authentication.service";
import {assertCredentials} from "../../../common/utils/request-credentials";
import {User} from "../../users/user.interface";

export class TwoFactorAuthenticationController {
    constructor(
        private readonly tfaService: TwoFactorAuthenticationService,
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

        const user = await req.credentials.user();

        const token = await this.tfaService.verifyOtp({
            tokenId: jwt.tid,
            code: req.body.code,
            user,
            meta: {
                ip: req.ip || null,
                browser: req.useragent?.browser || null,
                os: req.useragent?.os || null,
            },
            tfaCleared: jwt.tfa,
        });

        res.status(200).json({token});
    });

    enroll = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);
        const {jwt} = req.credentials;
        const user = await req.credentials.user();

        const result = await this.tfaService.enrollTfa({
            userId: user.id,
            tokenId: jwt.tid,
            code: req.body.code,
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
        const user = await req.credentials.user();

        await this.tfaService.disableTfa(user.id, req.body.password);

        res.status(200).json({
            disabled: true,
            message: "Two-factor authentication disabled successfully.",
        });
    });
}
