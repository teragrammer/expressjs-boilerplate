// src/modules/auth/authentication/authentication.routes.ts
import {Router} from "express";

import {loginSchema} from "./login.schema";
import {registerSchema} from "./register.schema";
import {AuthenticationController} from "./authentication.controller";
import {RegisterController} from "./register.controller";

import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {authRateLimiters} from "../../../common/middleware/rate-limiter.middleware";

import {authService} from "../../../config/container";

const authenticationController =
    new AuthenticationController(authService);

const registerController =
    new RegisterController(authService);

export default () => {
    const router = Router();

    // Global auth rate limiter applied to all auth endpoints
    router.use(authRateLimiters.globalAuth);

    router.post(
        "/register",
        authRateLimiters.register,
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

    router.get(
        "/logout",
        authRateLimiters.logout,
        AuthenticationMiddleware(),
        authenticationController.logout,
    );

    return router;
};
