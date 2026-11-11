"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/system/roles/role.routes.ts
const express_1 = require("express");
const authentication_middleware_1 = require("../../../common/middleware/authentication.middleware");
const authorization_middleware_1 = require("../../../common/middleware/authorization.middleware");
const validate_middleware_1 = require("../../../common/middleware/validate.middleware");
const route_guard_controller_1 = require("./route-guard.controller");
const route_guard_create_schema_1 = require("./route-guard-create.schema");
const container_1 = require("../../../config/container");
const roleController = new route_guard_controller_1.RouteGuardController(container_1.routeGuardService);
exports.default = () => {
    const router = (0, express_1.Router)();
    router.post("/", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("route-guards:create"),
        (0, validate_middleware_1.validate)(route_guard_create_schema_1.routeGuardCreateSchema, [
            "role_id", "route"
        ])
    ], roleController.create);
    router.get("/", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("route-guards:browse")], roleController.browse);
    router.get("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("route-guards:view")], roleController.view);
    router.delete("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("route-guards:delete")], roleController.delete);
    return router;
};
