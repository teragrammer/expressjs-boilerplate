"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/modules/users/user.routes.ts
const express_1 = require("express");
const authentication_middleware_1 = require("../../common/middleware/authentication.middleware");
const authorization_middleware_1 = require("../../common/middleware/authorization.middleware");
const validate_middleware_1 = require("../../common/middleware/validate.middleware");
const user_create_schema_1 = require("./validations/user-create.schema");
const user_update_schema_1 = require("./validations/user-update.schema");
const user_controller_1 = require("./controllers/user.controller");
const user_service_1 = require("./services/user.service");
const user_purge_service_1 = require("./services/user-purge.service");
const user_repository_1 = require("./user.repository");
const authentication_token_repository_1 = require("../auth/authentication/authentication-token.repository");
const security_util_1 = require("../../common/utils/security.util");
const environment_1 = require("../../config/environment");
const container_1 = require("../../config/container");
const userController = new user_controller_1.UserController(new user_service_1.UserService(new user_repository_1.UserRepository(), new security_util_1.SecurityUtil({
    bcryptSecret: environment_1.__ENV.BCRYPT_SECRET,
    bcryptSaltRounds: Number(environment_1.__ENV.BCRYPT_SALT_ROUND || 10),
}), new authentication_token_repository_1.AuthenticationTokenRepository()), new user_purge_service_1.UserPurgeService(new user_repository_1.UserRepository(), new authentication_token_repository_1.AuthenticationTokenRepository(), container_1.auditService), container_1.auditService);
exports.default = () => {
    const router = (0, express_1.Router)();
    router.post("/", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("users:create"),
        (0, validate_middleware_1.validate)(user_create_schema_1.userCreateSchema, [
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ])
    ], userController.create);
    router.put("/:id", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("users:update"),
        (0, validate_middleware_1.validate)((req) => (0, user_update_schema_1.userUpdateSchema)(String(req.params.id)), [
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ])
    ], userController.update);
    router.get("/", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("users:browse")], userController.browse);
    router.get("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("users:view")], userController.view);
    router.delete("/:id", [(0, authentication_middleware_1.AuthenticationMiddleware)(), (0, authorization_middleware_1.AuthorizationMiddleware)("users:delete")], userController.delete);
    /*
     * Permanent removal.
     *
     * Destructive: it requires a privileged role, a stated reason and
     * it produces an audit event. The reason travels in the
     * `X-Deletion-Reason` header.
     */
    router.post("/:id/purge", [
        (0, authentication_middleware_1.AuthenticationMiddleware)(),
        (0, authorization_middleware_1.AuthorizationMiddleware)("users:delete"),
    ], userController.purge);
    return router;
};
