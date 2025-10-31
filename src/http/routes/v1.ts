import {Router} from "express";
import {AuthenticationMiddleware} from "../middlewares/authentication.middleware";
import {PermissionMiddleware} from "../middlewares/permission.middleware";
import {TwoFactorAuthenticationMiddleware} from "../middlewares/two-factor-authentication.middleware";
import RegisterController from "../controllers/register.controller";
import AuthenticationController from "../controllers/authentication.controller";
import TwoFactorAuthenticationController from "../controllers/two-factor-authentication.controller";
import PasswordRecoveryController from "../controllers/password-recovery.controller";
import AccountController from "../controllers/account.controller";
import SettingController from "../controllers/setting.controller";
import RoleController from "../controllers/role.controller";
import UserController from "../controllers/user.controller";
import RouteGuardController from "../controllers/route-guard.controller";

const router = Router();

export default () => {
    router.post("/register", RegisterController.create);
    router.post("/login", AuthenticationController.login);
    router.get("/logout", [AuthenticationMiddleware()], AuthenticationController.logout);

    router.get("/tfa/send", [AuthenticationMiddleware()], TwoFactorAuthenticationController.send);
    router.post("/tfa/validate", [AuthenticationMiddleware()], TwoFactorAuthenticationController.validate);

    router.post("/password-recovery/send", PasswordRecoveryController.send);
    router.post("/password-recovery/validate", PasswordRecoveryController.validate);

    router.put("/account/information", [AuthenticationMiddleware(), TwoFactorAuthenticationMiddleware()], AccountController.information);
    router.put("/account/password", [AuthenticationMiddleware(), TwoFactorAuthenticationMiddleware()], AccountController.password);

    router.get("/settings", [AuthenticationMiddleware(), PermissionMiddleware("settings:browse")], SettingController.browse);
    router.get("/settings/values", [AuthenticationMiddleware()], SettingController.values);
    router.get("/settings/:id", [AuthenticationMiddleware(), PermissionMiddleware("settings:view")], SettingController.view);
    router.post("/settings", [AuthenticationMiddleware(), PermissionMiddleware("settings:create")], SettingController.create);
    router.put("/settings/:id", [AuthenticationMiddleware(), PermissionMiddleware("settings:update")], SettingController.update);
    router.delete("/settings/:id", [AuthenticationMiddleware(), PermissionMiddleware("settings:delete")], SettingController.delete);

    router.get("/roles", [AuthenticationMiddleware(), PermissionMiddleware("roles:browse")], RoleController.browse);
    router.get("/roles/:id", [AuthenticationMiddleware(), PermissionMiddleware("roles:view")], RoleController.view);
    router.post("/roles", [AuthenticationMiddleware(), PermissionMiddleware("roles:create")], RoleController.create);
    router.put("/roles/:id", [AuthenticationMiddleware(), PermissionMiddleware("roles:update")], RoleController.update);
    router.delete("/roles/:id", [AuthenticationMiddleware(), PermissionMiddleware("roles:delete")], RoleController.delete);

    router.get("/route/guards", [AuthenticationMiddleware(), PermissionMiddleware("route-guards:browse")], RouteGuardController.browse);
    router.get("/route/guards/:id", [AuthenticationMiddleware(), PermissionMiddleware("route-guards:view")], RouteGuardController.view);
    router.post("/route/guards", [AuthenticationMiddleware(), PermissionMiddleware("route-guards:create")], RouteGuardController.create);
    router.delete("/route/guards/:id", [AuthenticationMiddleware(), PermissionMiddleware("route-guards:delete")], RouteGuardController.delete);

    router.get("/users", [AuthenticationMiddleware(), PermissionMiddleware("users:browse")], UserController.browse);
    router.get("/users/:id", [AuthenticationMiddleware(), PermissionMiddleware("users:view")], UserController.view);
    router.post("/users", [AuthenticationMiddleware(), PermissionMiddleware("users:create")], UserController.create);
    router.put("/users/:id", [AuthenticationMiddleware(), PermissionMiddleware("users:update")], UserController.update);
    router.delete("/users/:id", [AuthenticationMiddleware(), PermissionMiddleware("users:delete")], UserController.delete);

    return router;
}