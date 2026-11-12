// src/modules/system/route-guards/route-guard.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {AuthorizationMiddleware} from "../../../common/middleware/authorization.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {routeGuardCreateSchema} from "./route-guard-create.schema";
import {routeGuardController} from "../../../config/container";

export default () => {
    const router = Router();

    router.post("/", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("route-guards:create"),
        validate(routeGuardCreateSchema, [
            "role_id", "route"
        ])
    ], routeGuardController.create);

    router.get("/", [AuthenticationMiddleware(), AuthorizationMiddleware("route-guards:browse")], routeGuardController.browse);

    router.get("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("route-guards:view")], routeGuardController.view);

    router.delete("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("route-guards:delete")], routeGuardController.delete);

    return router;
};
