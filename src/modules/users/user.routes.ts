// src/modules/users/user.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {AuthorizationMiddleware} from "../../common/middleware/authorization.middleware";
import {validate} from "../../common/middleware/validate.middleware";
import {privilegedFieldsMiddleware} from "../../common/middleware/privileged-fields.middleware";
import {userCreateSchema} from "./validations/user-create.schema";
import {userUpdateSchema} from "./validations/user-update.schema";
import {UserController} from "./controllers/user.controller";
import {UserService} from "./services/user.service";
import {UserPurgeService} from "./services/user-purge.service";
import {UserRepository} from "./user.repository";
import {AuthenticationTokenRepository} from "../auth/authentication/authentication-token.repository";
import {SecurityUtil} from "../../common/utils/security.util";
import {__ENV} from "../../config/environment";
import {auditService} from "../../config/container";

const userController = new UserController(
    new UserService(
        new UserRepository(),
        new SecurityUtil({
            bcryptSecret: __ENV.BCRYPT_SECRET,
            bcryptSaltRounds: Number(__ENV.BCRYPT_SALT_ROUND || 10),
        }),
        new AuthenticationTokenRepository(),
    ),
    new UserPurgeService(
        new UserRepository(),
        new AuthenticationTokenRepository(),
        auditService,
    ),
    auditService,
);

export default () => {
    const router = Router();

    router.post("/", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("users:create"),
        /*
         * The privileged fields are rejected before the validation,
         * so the endpoint cannot be used to probe existing values.
         */
        privilegedFieldsMiddleware(),
        validate(userCreateSchema, [
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ])
    ], userController.create);

    router.put("/:id", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("users:update"),
        privilegedFieldsMiddleware(),
        validate((req) => userUpdateSchema(String(req.params.id)), [
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ])
    ], userController.update);

    router.get("/", [AuthenticationMiddleware(), AuthorizationMiddleware("users:browse")], userController.browse);

    router.get("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("users:view")], userController.view);

    router.delete("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("users:delete")], userController.delete);

    /*
     * Permanent removal.
     *
     * Destructive: it requires a privileged role, a stated reason and
     * it produces an audit event. The reason travels in the
     * `X-Deletion-Reason` header.
     */
    router.post("/:id/purge", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("users:delete"),
    ], userController.purge);

    return router;
}