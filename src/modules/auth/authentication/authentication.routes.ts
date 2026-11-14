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
            /*
             * Validate before reserving the key: a failed validation
             * must not consume an idempotency key, and the hash must be
             * computed from the validated payload rather than the
             * empty sanitizer placeholder.
             */
            validate(registerSchema, [
                "first_name",
                "middle_name",
                "last_name",
                "username",
                "password",
                "email",
            ]),
            idempotency({scope: "auth:register"}),
        ],
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

    /*
     * Logout is safe for a pending-TFA session: it only deletes that
     * session and lets the caller abandon an incomplete login.
     */
    router.post(
        "/logout",
        authRateLimiters.logout,
        AuthenticationMiddleware(true, {allowPendingTfa: true}),
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
