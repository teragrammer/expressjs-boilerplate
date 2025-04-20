import {Express, Router} from "express";
import {AuthenticationMiddleware} from "../middlewares/authentication.middleware";
import {PermissionMiddleware} from "../middlewares/permission.middleware";
import {TwoFactorAuthenticationMiddleware} from "../middlewares/two-factor-authentication.middleware";
import RegisterController from "../controllers/register.controller";
import AuthenticationController from "../controllers/authentication.controller";
import TwoFactorAuthenticationController from "../controllers/two-factor-authentication.controller";
import AccountController from "../controllers/account.controller";
import SettingController from "../controllers/setting.controller";
import UserController from "../controllers/user.controller";
import RoleController from "../controllers/role.controller";

const router = Router();

export default (app: Express) => {
    router.post("/register", RegisterController(app).create);
    router.post("/login", AuthenticationController(app).login);
    router.get("/logout", [AuthenticationMiddleware(app)], AuthenticationController(app).logout);

    router.get("/tfa/send", [AuthenticationMiddleware(app)], TwoFactorAuthenticationController(app).send);
    router.post("/tfa/validate", [AuthenticationMiddleware(app)], TwoFactorAuthenticationController(app).validate);

    router.put("/account/information", [AuthenticationMiddleware(app), TwoFactorAuthenticationMiddleware(app)], AccountController(app).information);
    router.put("/account/password", [AuthenticationMiddleware(app)], AccountController(app).password);

    router.get("/settings", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], SettingController(app).browse);
    router.get("/settings/values", [AuthenticationMiddleware(app)], SettingController(app).values);
    router.get("/settings/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], SettingController(app).view);
    router.post("/settings", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], SettingController(app).create);
    router.put("/settings/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], SettingController(app).update);
    router.delete("/settings/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], SettingController(app).delete);

    router.get("/roles", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], RoleController(app).browse);
    router.get("/roles/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], RoleController(app).view);
    router.post("/roles", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], RoleController(app).create);
    router.put("/roles/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], RoleController(app).update);
    router.delete("/roles/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], RoleController(app).delete);

    router.get("/users", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], UserController(app).browse);
    router.get("/users/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], UserController(app).view);
    router.post("/users", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], UserController(app).create);
    router.put("/users/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], UserController(app).update);
    router.delete("/users/:id", [AuthenticationMiddleware(app), PermissionMiddleware(['admin'])], UserController(app).delete);

    return router
}