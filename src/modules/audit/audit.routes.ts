// src/modules/audit/audit.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {AuthorizationMiddleware} from "../../common/middleware/authorization.middleware";
import {auditController} from "../../config/container";

export default () => {
    const router = Router();

    /**
     * Reads audit events.
     *
     * Restricted to the `audit:view` route guard. Auditors and admins
     * use this endpoint to trace a request id or an actor.
     */
    router.get(
        "/",
        [
            AuthenticationMiddleware(),
            AuthorizationMiddleware("audit:view"),
        ],
        auditController.browse,
    );

    return router;
};
