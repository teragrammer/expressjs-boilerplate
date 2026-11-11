// src/modules/users/user.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {AuthorizationMiddleware} from "../../common/middleware/authorization.middleware";
import {validate} from "../../common/middleware/validate.middleware";
import {userCreateSchema} from "./validations/user-create.schema";
import {userUpdateSchema} from "./validations/user-update.schema";
import {UserController} from "./controllers/user.controller";
import {UserService} from "./services/user.service";
import {UserRepository} from "./user.repository";
import {AuthenticationTokenRepository} from "../auth/authentication/authentication-token.repository";
import {SecurityUtil} from "../../common/utils/security.util";
import {__ENV} from "../../config/environment";

const userController = new UserController(new UserService(
    new UserRepository(),
    new SecurityUtil({
        bcryptSecret: __ENV.BCRYPT_SECRET,
        bcryptSaltRounds: Number(__ENV.BCRYPT_SALT_ROUND || 10),
    }),
    new AuthenticationTokenRepository(),
));

export default () => {
    const router = Router();

    router.post("/", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("users:create"),
        validate(userCreateSchema, [
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ])
    ], userController.create);

    router.put("/:id", [
        AuthenticationMiddleware(),
        AuthorizationMiddleware("users:update"),
        validate((req) => userUpdateSchema(String(req.params.id)), [
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ])
    ], userController.update);

    router.get("/", [AuthenticationMiddleware(), AuthorizationMiddleware("users:browse")], userController.browse);

    router.get("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("users:view")], userController.view);

    router.delete("/:id", [AuthenticationMiddleware(), AuthorizationMiddleware("users:delete")], userController.delete);

    return router;
}