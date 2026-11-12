// src/modules/auth/password-recovery/password-recovery.routes.ts
import {Router} from "express";

import {validate} from "../../../common/middleware/validate.middleware";
import {authRateLimiters} from "../../../common/middleware/rate-limiter.middleware";

import {passwordRecoveryController} from "../../../config/container";

import {passwordRecoverySendSchema} from "./password-recovery-send.schema";
import {passwordRecoveryValidateSchema} from "./password-recovery-validate.schema";

export default () => {
    const router = Router();

    router.post(
        "/password-recovery/send",
        authRateLimiters.passwordRecoverySend,
        validate(
            passwordRecoverySendSchema,
            ["type", "send_to"],
        ),
        passwordRecoveryController.send,
    );

    router.post(
        "/password-recovery/validate",
        authRateLimiters.passwordRecoveryValidate,
        validate(
            passwordRecoveryValidateSchema,
            [
                "type",
                "send_to",
                "code",
                "new_password",
            ],
        ),
        passwordRecoveryController.validate,
    );

    return router;
};
