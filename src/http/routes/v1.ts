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

    router.get("/settings", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], SettingController.browse);
    router.get("/settings/values", [AuthenticationMiddleware()], SettingController.values);
    router.get("/settings/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], SettingController.view);
    router.post("/settings", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], SettingController.create);
    router.put("/settings/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], SettingController.update);
    router.delete("/settings/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], SettingController.delete);

    router.get("/roles", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], RoleController.browse);
    router.get("/roles/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], RoleController.view);
    router.post("/roles", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], RoleController.create);
    router.put("/roles/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], RoleController.update);
    router.delete("/roles/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], RoleController.delete);

    router.get("/users", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], UserController.browse);
    router.get("/users/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], UserController.view);
    router.post("/users", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], UserController.create);
    router.put("/users/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], UserController.update);
    router.delete("/users/:id", [AuthenticationMiddleware(), PermissionMiddleware(["admin"])], UserController.delete);

    return router;
}