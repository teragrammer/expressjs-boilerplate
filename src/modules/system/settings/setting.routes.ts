import {Router} from "express";
import {AuthenticationMiddleware} from "../../../common/middleware/authentication.middleware";
import {AuthorizationMiddleware} from "../../../common/middleware/authorization.middleware";
import {validate} from "../../../common/middleware/validate.middleware";
import {settingCreateSchema} from "./setting-create.schema";
import {settingUpdateSchema} from "./setting-update.schema";
import {SettingController} from "./setting.controller";
import {SettingService} from "./setting.service";
import {SettingRepository} from "./setting.repository";
import {auditService, redisCache} from "../../../config/container";

const settingController = new SettingController(
    new SettingService(new SettingRepository(), redisCache),
    auditService,
);

export default () => {
    const router = Router();

    router.post("/", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("settings:create"),
        validate(settingCreateSchema, [
            "name", "slug", "value", "description", "type", "is_disabled", "is_public"
        ])
    ], settingController.create);

    router.put("/:id", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("settings:update"),
        validate((req) => settingUpdateSchema(Number(req.params.id)), [
            "name", "slug", "value", "description", "type", "is_disabled", "is_public"
        ])
    ], settingController.update);

    router.get("/", [AuthenticationMiddleware(), AuthorizationMiddleware("settings:browse")], settingController.browse);

    /*
     * Public settings values.
     *
     * The response only contains settings flagged `is_public=true` and
     * `is_disabled=false`, so it is safe to expose without
     * authentication. It is served from the shared cache.
     */
    router.get("/values", settingController.values);

    router.get("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("settings:view")], settingController.view);

    router.delete("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("settings:delete")], settingController.delete);

    return router;
}