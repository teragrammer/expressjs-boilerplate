// src/modules/auth/verification/verification.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {assertCredentials} from "../../../common/utils/request-credentials";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {VerificationService} from "./verification.service";
import {
    SendVerificationResult,
    VerificationChannel,
} from "./verification.interface";

/**
 * HTTP adapter for contact verification.
 *
 * The four endpoints share the same response contract: sending always
 * returns the same shape (so the response cannot be used to enumerate
 * accounts) and confirmation returns the verified channel.
 */
export class VerificationController {
    constructor(
        private readonly verificationService: VerificationService,
    ) {
    }

    sendEmail = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);

        const {email} = req.sanitize.data as {email: string};

        const result = await this.verificationService.send(
            req.credentials.jwt.uid,
            "email",
            email,
        );

        this.respondSent(res, result);
    });

    confirmEmail = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);

        const {code} = req.sanitize.data as {code: string};

        const result = await this.verificationService.confirm(
            req.credentials.jwt.uid,
            code,
        );

        this.respondConfirmed(res, result);
    });

    sendPhone = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);

        const {phone} = req.sanitize.data as {phone: string};

        if (!phone) {
            throw new AppError(Messages.INVALID_REQUEST);
        }

        const result = await this.verificationService.send(
            req.credentials.jwt.uid,
            "phone",
            phone,
        );

        this.respondSent(res, result);
    });

    confirmPhone = catchAsync(async (req: Request, res: Response): Promise<void> => {
        assertCredentials(req);

        const {code} = req.sanitize.data as {code: string};

        const result = await this.verificationService.confirm(
            req.credentials.jwt.uid,
            code,
        );

        this.respondConfirmed(res, result);
    });

    private respondSent(
        res: Response,
        result: SendVerificationResult,
    ): void {
        res.status(200).json({
            sent: result.sent,
            expires_at: result.expiresAt,
        });
    }

    private respondConfirmed(
        res: Response,
        result: {verified: true; channel: VerificationChannel},
    ): void {
        res.status(200).json({
            verified: result.verified,
            channel: result.channel,
        });
    }
}
