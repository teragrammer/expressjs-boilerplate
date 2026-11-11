"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/users/account.routes.ts
const express_1 = require("express");
const authentication_middleware_1 = require("../../common/middleware/authentication.middleware");
const two_factor_authentication_middleware_1 = require("../../common/middleware/two-factor-authentication.middleware");
const validate_middleware_1 = require("../../common/middleware/validate.middleware");
const account_information_schema_1 = require("./validations/account-information.schema");
const account_controller_1 = require("./controllers/account.controller");
const account_password_schema_1 = require("./validations/account-password.schema");
const container_1 = require("../../config/container");
const verification_routes_1 = __importDefault(require("../auth/verification/verification.routes"));
const accountController = new account_controller_1.AccountController(container_1.accountService);
exports.default = () => {
    const router = (0, express_1.Router)();
    /*
     * Verification endpoints live under /account because they operate
     * on the caller's own contact details.
     */
    router.use((0, verification_routes_1.default)());
    router.put("/information", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, two_factor_authentication_middleware_1.TwoFactorAuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)(account_information_schema_1.accountInformationSchema, ["first_name", "middle_name", "last_name", "address"]),
    ], accountController.information);
    router.put("/password", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, two_factor_authentication_middleware_1.TwoFactorAuthenticationMiddleware)(),
        (0, validate_middleware_1.validate)((req) => (0, account_password_schema_1.accountPasswordSchema)(req.credentials.jwt.uid), ["current_password", "new_password", "username", "email", "phone"]),
    ], accountController.password);
    return router;
};
