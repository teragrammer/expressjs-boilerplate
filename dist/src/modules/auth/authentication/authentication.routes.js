"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/auth/authentication/authentication.routes.ts
const express_1 = require("express");
const login_schema_1 = require("./login.schema");
const register_schema_1 = require("./register.schema");
const authentication_controller_1 = require("./authentication.controller");
const authentication_refresh_controller_1 = require("./authentication-refresh.controller");
const register_controller_1 = require("./register.controller");
const authentication_middleware_1 = require("../../../common/middleware/authentication.middleware");
const validate_middleware_1 = require("../../../common/middleware/validate.middleware");
const rate_limiter_middleware_1 = require("../../../common/middleware/rate-limiter.middleware");
const container_1 = require("../../../config/container");
const authenticationController = new authentication_controller_1.AuthenticationController(container_1.authService, container_1.sessionService, container_1.refreshTokenRepository, container_1.auditService);
const authenticationRefreshController = new authentication_refresh_controller_1.AuthenticationRefreshController(container_1.sessionService, container_1.auditService);
const registerController = new register_controller_1.RegisterController(container_1.authService, container_1.auditService);
exports.default = () => {
    const router = (0, express_1.Router)();
    // Global auth rate limiter applied to all auth endpoints
    router.use(rate_limiter_middleware_1.authRateLimiters.globalAuth);
    router.post("/register", rate_limiter_middleware_1.authRateLimiters.register, (0, validate_middleware_1.validate)(register_schema_1.registerSchema, [
        "first_name",
        "middle_name",
        "last_name",
        "username",
        "password",
        "email",
    ]), registerController.create);
    router.post("/login", rate_limiter_middleware_1.authRateLimiters.login, (0, validate_middleware_1.validate)(login_schema_1.loginSchema, [
        "username",
        "password",
    ]), authenticationController.login);
    router.post("/refresh", rate_limiter_middleware_1.authRateLimiters.refresh, authenticationRefreshController.refresh);
    router.post("/logout", rate_limiter_middleware_1.authRateLimiters.logout, (0, authentication_middleware_1.AuthenticationMiddleware)(), authenticationController.logout);
    /*
     * Deprecated alias for the pre-1.0 `GET /auth/logout`.
     *
     * State-changing operations must use POST; the alias exists only
     * for a deprecation window and is documented as such.
     */
    router.get("/logout", rate_limiter_middleware_1.authRateLimiters.logout, (0, authentication_middleware_1.AuthenticationMiddleware)(), authenticationController.logout);
    router.post("/logout-all", (0, authentication_middleware_1.AuthenticationMiddleware)(), authenticationController.logoutAll);
    router.get("/sessions", (0, authentication_middleware_1.AuthenticationMiddleware)(), authenticationController.sessions);
    return router;
};
