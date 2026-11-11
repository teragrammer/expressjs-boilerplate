// src/modules/auth/two-factor-authentication/two-factor-authentication.routes.ts
import {Router} from "express";

import {TwoFactorAuthenticationController} from "./two-factor-authentication.controller";
import {verifyOtpSchema} from "./two-factor-authentication.schema";

import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {authRateLimiters} from "../../../common/middleware/rate-limiter.middleware";

import {twoFactorAuthenticationService} from "../../../config/container";

const twoFactorAuthenticationController =
    new TwoFactorAuthenticationController(
        twoFactorAuthenticationService,
    );

export default () => {
    const router = Router();

    router.get(
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
        "/tfa/enroll",
        [
            authRateLimiters.tfaValidate,
            AuthenticationMiddleware(),
            validate(verifyOtpSchema, ["code"]),
        ],
        twoFactorAuthenticationController.enroll,
    );

    // TFA Disable - requires authentication and password verification
    router.post(
        "/tfa/disable",
        [
            AuthenticationMiddleware(),
            // Rate limit disable attempts
        ],
        twoFactorAuthenticationController.disable,
    );

    return router;
};
