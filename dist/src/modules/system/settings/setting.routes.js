"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authentication_middleware_1 = require("../../../common/middleware/authentication.middleware");
const authorization_middleware_1 = require("../../../common/middleware/authorization.middleware");
const validate_middleware_1 = require("../../../common/middleware/validate.middleware");
const setting_create_schema_1 = require("./setting-create.schema");
const setting_update_schema_1 = require("./setting-update.schema");
const setting_controller_1 = require("./setting.controller");
const setting_service_1 = require("./setting.service");
const setting_repository_1 = require("./setting.repository");
const container_1 = require("../../../config/container");
const settingController = new setting_controller_1.SettingController(new setting_service_1.SettingService(new setting_repository_1.SettingRepository(), container_1.redisCache), container_1.auditService);
exports.default = () => {
    const router = (0, express_1.Router)();
    router.post("/", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("settings:create"),
        (0, validate_middleware_1.validate)(setting_create_schema_1.settingCreateSchema, [
            "name", "slug", "value", "description", "type", "is_disabled", "is_public"
        ])
    ], settingController.create);
    router.put("/:id", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("settings:update"),
        (0, validate_middleware_1.validate)((req) => (0, setting_update_schema_1.settingUpdateSchema)(Number(req.params.id)), [
            "name", "slug", "value", "description", "type", "is_disabled", "is_public"
        ])
    ], settingController.update);
    router.get("/", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("settings:browse")], settingController.browse);
    /*
     * Public settings values.
     *
     * The response only contains settings flagged `is_public=true` and
     * `is_disabled=false`, so it is safe to expose without
     * authentication. It is served from the shared cache.
     */
    router.get("/values", settingController.values);
    router.get("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("settings:view")], settingController.view);
    router.delete("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("settings:delete")], settingController.delete);
    return router;
};
