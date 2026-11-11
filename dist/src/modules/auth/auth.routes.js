"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/auth/auth.routes.ts
const express_1 = require("express");
const authentication_routes_1 = __importDefault(require("./authentication/authentication.routes"));
const two_factor_authentication_routes_1 = __importDefault(require("./two-factor-authentication/two-factor-authentication.routes"));
const password_recovery_routes_1 = __importDefault(require("./password-recovery/password-recovery.routes"));
exports.default = () => {
    const router = (0, express_1.Router)();
    router.use((0, authentication_routes_1.default)());
    router.use((0, two_factor_authentication_routes_1.default)());
    router.use((0, password_recovery_routes_1.default)());
    return router;
};
