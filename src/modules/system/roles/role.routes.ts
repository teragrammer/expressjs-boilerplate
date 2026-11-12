// src/modules/system/roles/role.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {AuthorizationMiddleware} from "../../../common/middleware/authorization.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {roleCreateSchema} from "./role-create.schema";
import {roleUpdateSchema} from "./role-update.schema";
import {roleController} from "../../../config/container";

export default () => {
    const router = Router();

    router.post("/", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("roles:create"),
        validate(roleCreateSchema, [
            "name", "slug", "description", "is_public", "is_bypass_authorization"
        ])
    ], roleController.create);

    router.put("/:id", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("roles:update"),
        validate((req) => roleUpdateSchema(Number(req.params.id)), [
            "name", "slug", "description", "is_public", "is_bypass_authorization"
        ])
    ], roleController.update);

    router.get("/", [AuthenticationMiddleware(), AuthorizationMiddleware("roles:browse")], roleController.browse);

    router.get("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("roles:view")], roleController.view);

    router.delete("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("roles:delete")], roleController.delete);

    return router;
};
