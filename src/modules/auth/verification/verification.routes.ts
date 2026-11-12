// src/modules/auth/verification/verification.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {authRateLimiters} from "../../../common/middleware/rate-limiter.middleware";
import {verificationController} from "../../../config/container";
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
        verificationController.sendEmail,
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
        verificationController.confirmEmail,
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
        verificationController.sendPhone,
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
        verificationController.confirmPhone,
    );

    return router;
};
