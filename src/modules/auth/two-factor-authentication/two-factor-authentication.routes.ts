// src/modules/auth/two-factor-authentication/two-factor-authentication.routes.ts
import {Router} from "express";

import {
    disableTfaSchema,
    recoveryCodeSchema,
    verifyOtpSchema,
} from "./two-factor-authentication.schema";

import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {authRateLimiters} from "../../../common/middleware/rate-limiter.middleware";

import {twoFactorAuthenticationController} from "../../../config/container";

export default () => {
    const router = Router();

    /*
     * Sending an OTP is a state-changing operation, so it uses POST.
     */
    router.post(
        "/tfa/send",
        authRateLimiters.tfaSend,
        AuthenticationMiddleware(),
        twoFactorAuthenticationController.send,
    );

    router.post(
        "/tfa/validate",
        [
            authRateLimiters.tfaValidate,
            AuthenticationMiddleware(),
            validate(verifyOtpSchema, ["code"]),
        ],
        twoFactorAuthenticationController.validate,
    );

    // TFA Enrollment - requires authentication and a valid OTP
    router.post(
        "/tfa/enroll/send",
        [
            authRateLimiters.tfaSend,
            AuthenticationMiddleware(),
        ],
        twoFactorAuthenticationController.enrollSend,
    );

    router.post(
        "/tfa/enroll",
        [
            authRateLimiters.tfaValidate,
            AuthenticationMiddleware(),
            validate(verifyOtpSchema, ["code"]),
        ],
        twoFactorAuthenticationController.enroll,
    );

    /*
     * Recovery-code redemption. The caller is authenticated but has
     * not completed the second factor, so only this endpoint and the
     * challenge endpoints accept the pending-TFA token.
     */
    router.post(
        "/tfa/recovery",
        [
            authRateLimiters.tfaValidate,
            AuthenticationMiddleware(),
            validate(recoveryCodeSchema, ["code"]),
        ],
        twoFactorAuthenticationController.recovery,
    );

    // TFA Disable - requires authentication and password verification
    router.post(
        "/tfa/disable",
        [
            authRateLimiters.tfaValidate,
            AuthenticationMiddleware(),
            validate(disableTfaSchema, ["password"]),
        ],
        twoFactorAuthenticationController.disable,
    );

    return router;
};
