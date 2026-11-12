// src/modules/auth/authentication/authentication.routes.ts
import {Router} from "express";

import {loginSchema} from "./login.schema";
import {registerSchema} from "./register.schema";

import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {authRateLimiters} from "../../../common/middleware/rate-limiter.middleware";
import {idempotency} from "../../../common/middleware/idempotency.middleware";

import {
    authenticationController,
    authenticationRefreshController,
    registerController,
} from "../../../config/container";

export default () => {
    const router = Router();

    // Global auth rate limiter applied to all auth endpoints
    router.use(authRateLimiters.globalAuth);

    router.post(
        "/register",
        [
            authRateLimiters.register,
            idempotency({scope: "auth:register"}),
        ],
        validate(registerSchema, [
            "first_name",
            "middle_name",
            "last_name",
            "username",
            "password",
            "email",
        ]),
        registerController.create,
    );

    router.post(
        "/login",
        authRateLimiters.login,
        validate(loginSchema, [
            "username",
            "password",
        ]),
        authenticationController.login,
    );

    router.post(
        "/refresh",
        authRateLimiters.refresh,
        authenticationRefreshController.refresh,
    );

    router.post(
        "/logout",
        authRateLimiters.logout,
        AuthenticationMiddleware(),
        authenticationController.logout,
    );

    router.post(
        "/logout-all",
        AuthenticationMiddleware(),
        authenticationController.logoutAll,
    );

    router.get(
        "/sessions",
        AuthenticationMiddleware(),
        authenticationController.sessions,
    );

    return router;
};
