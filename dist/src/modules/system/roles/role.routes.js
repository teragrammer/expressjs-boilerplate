"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/system/roles/role.routes.ts
const express_1 = require("express");
const authentication_middleware_1 = require("../../../common/middleware/authentication.middleware");
const authorization_middleware_1 = require("../../../common/middleware/authorization.middleware");
const validate_middleware_1 = require("../../../common/middleware/validate.middleware");
const role_create_schema_1 = require("./role-create.schema");
const role_update_schema_1 = require("./role-update.schema");
const role_controller_1 = require("./role.controller");
const role_service_1 = require("./role.service");
const role_repository_1 = require("./role.repository");
const roleController = new role_controller_1.RoleController(new role_service_1.RoleService(new role_repository_1.RoleRepository()));
exports.default = () => {
    const router = (0, express_1.Router)();
    router.post("/", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("roles:create"),
        (0, validate_middleware_1.validate)(role_create_schema_1.roleCreateSchema, [
            "name", "slug", "description", "is_public", "is_bypass_authorization"
        ])
    ], roleController.create);
    router.put("/:id", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("roles:update"),
        (0, validate_middleware_1.validate)((req) => (0, role_update_schema_1.roleUpdateSchema)(Number(req.params.id)), [
            "name", "slug", "description", "is_public", "is_bypass_authorization"
        ])
    ], roleController.update);
    router.get("/", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("roles:browse")], roleController.browse);
    router.get("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("roles:view")], roleController.view);
    router.delete("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("roles:delete")], roleController.delete);
    return router;
};
