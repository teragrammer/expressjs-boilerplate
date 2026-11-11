"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/auth/two-factor-authentication/two-factor-authentication.routes.ts
const express_1 = require("express");
const two_factor_authentication_controller_1 = require("./two-factor-authentication.controller");
const two_factor_authentication_schema_1 = require("./two-factor-authentication.schema");
const authentication_middleware_1 = require("../../../common/middleware/authentication.middleware");
const validate_middleware_1 = require("../../../common/middleware/validate.middleware");
const rate_limiter_middleware_1 = require("../../../common/middleware/rate-limiter.middleware");
const container_1 = require("../../../config/container");
const twoFactorAuthenticationController = new two_factor_authentication_controller_1.TwoFactorAuthenticationController(container_1.twoFactorAuthenticationService);
exports.default = () => {
    const router = (0, express_1.Router)();
    router.get("/tfa/send", rate_limiter_middleware_1.authRateLimiters.tfaSend, (0, authentication_middleware_1.AuthenticationMiddleware)(), twoFactorAuthenticationController.send);
    router.post("/tfa/validate", [
        rate_limiter_middleware_1.authRateLimiters.tfaValidate,
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)(two_factor_authentication_schema_1.verifyOtpSchema, ["code"]),
    ], twoFactorAuthenticationController.validate);
    // TFA Enrollment - requires authentication and a valid OTP
    router.post("/tfa/enroll", [
        rate_limiter_middleware_1.authRateLimiters.tfaValidate,
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)(two_factor_authentication_schema_1.verifyOtpSchema, ["code"]),
    ], twoFactorAuthenticationController.enroll);
    // TFA Disable - requires authentication and password verification
    router.post("/tfa/disable", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        // Rate limit disable attempts
    ], twoFactorAuthenticationController.disable);
    return router;
};
