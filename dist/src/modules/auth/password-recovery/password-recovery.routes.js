"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/auth/password-recovery/password-recovery.routes.ts
const express_1 = require("express");
const password_recovery_controller_1 = require("./password-recovery.controller");
const validate_middleware_1 = require("../../../common/middleware/validate.middleware");
const rate_limiter_middleware_1 = require("../../../common/middleware/rate-limiter.middleware");
const container_1 = require("../../../config/container");
const password_recovery_send_schema_1 = require("./password-recovery-send.schema");
const password_recovery_validate_schema_1 = require("./password-recovery-validate.schema");
const passwordRecoveryController = new password_recovery_controller_1.PasswordRecoveryController(container_1.passwordRecoveryService);
exports.default = () => {
    const router = (0, express_1.Router)();
    router.post("/password-recovery/send", rate_limiter_middleware_1.authRateLimiters.passwordRecoverySend, (0, validate_middleware_1.validate)(password_recovery_send_schema_1.passwordRecoverySendSchema, ["type", "send_to"]), passwordRecoveryController.send);
    router.post("/password-recovery/validate", rate_limiter_middleware_1.authRateLimiters.passwordRecoveryValidate, (0, validate_middleware_1.validate)(password_recovery_validate_schema_1.passwordRecoveryValidateSchema, [
        "type",
        "send_to",
        "code",
        "new_password",
    ]), passwordRecoveryController.validate);
    return router;
};
