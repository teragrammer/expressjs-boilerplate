// src/modules/auth/two-factor-authentication/two-factor-authentication.routes.ts
import {Router} from "express";

import {TwoFactorAuthenticationController} from "./two-factor-authentication.controller";
import {verifyOtpSchema} from "./two-factor-authentication.schema";

import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {validate} from "../../../common/middleware/validate.middleware";

import {twoFactorAuthenticationService} from "../../../config/container";

const twoFactorAuthenticationController =
    new TwoFactorAuthenticationController(
        twoFactorAuthenticationService,
    );

export default () => {
    const router = Router();

    router.get(
        "/tfa/send",
        AuthenticationMiddleware(),
        twoFactorAuthenticationController.send,
    );

    router.post(
        "/tfa/validate",
        [
            AuthenticationMiddleware(),
            validate(verifyOtpSchema, ["code"]),
        ],
        twoFactorAuthenticationController.validate,
    );

    return router;
};
