// src/modules/auth/verification/verification.routes.ts
import {Router} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {authRateLimiters} from "../../../common/middleware/rate-limiter.middleware";
import {assertCredentials} from "../../../common/utils/request-credentials";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {verificationService} from "../../../config/container";
import {sendVerificationSchema} from "./verification.schema";

export default () => {
    const router = Router();

    /**
     * Requests a verification code for the caller's email.
     *
     * The response is identical whether or not the address is already
     * registered, so the endpoint cannot be used to enumerate accounts.
     */
    router.post(
        "/email/verification/send",
        [
            authRateLimiters.verificationSend,
            AuthenticationMiddleware(),
            validate(sendVerificationSchema, ["email"]),
        ],
        catchAsync(async (req, res) => {
            assertCredentials(req);

            const {email} = req.sanitize.data as {email: string};

            const result = await verificationService.send(
                req.credentials.jwt.uid,
                "email",
                email,
            );

            res.status(200).json({
                sent: true,
                expires_at: result.expiresAt,
            });
        }),
    );

    /**
     * Confirms an email verification code.
     */
    router.post(
        "/email/verification/confirm",
        [
            authRateLimiters.verificationConfirm,
            AuthenticationMiddleware(),
            validate(sendVerificationSchema, ["code"]),
        ],
        catchAsync(async (req, res) => {
            assertCredentials(req);

            const {code} = req.sanitize.data as {code: string};

            const result = await verificationService.confirm(
                req.credentials.jwt.uid,
                code,
            );

            res.status(200).json({
                verified: result.verified,
                channel: result.channel,
            });
        }),
    );

    /**
     * Requests a verification code for the caller's phone.
     */
    router.post(
        "/phone/verification/send",
        [
            authRateLimiters.verificationSend,
            AuthenticationMiddleware(),
            validate(sendVerificationSchema, ["phone"]),
        ],
        catchAsync(async (req, res) => {
            assertCredentials(req);

            const {phone} = req.sanitize.data as {phone: string};

            if (!phone) {
                throw new AppError(Messages.INVALID_REQUEST);
            }

            const result = await verificationService.send(
                req.credentials.jwt.uid,
                "phone",
                phone,
            );

            res.status(200).json({
                sent: true,
                expires_at: result.expiresAt,
            });
        }),
    );

    /**
     * Confirms a phone verification code.
     */
    router.post(
        "/phone/verification/confirm",
        [
            authRateLimiters.verificationConfirm,
            AuthenticationMiddleware(),
            validate(sendVerificationSchema, ["code"]),
        ],
        catchAsync(async (req, res) => {
            assertCredentials(req);

            const {code} = req.sanitize.data as {code: string};

            const result = await verificationService.confirm(
                req.credentials.jwt.uid,
                code,
            );

            res.status(200).json({
                verified: result.verified,
                channel: result.channel,
            });
        }),
    );

    return router;
};
