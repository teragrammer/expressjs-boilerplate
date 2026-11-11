// src/modules/users/account.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {TwoFactorAuthenticationMiddleware} from "../../common/middleware/two-factor-authentication.middleware";
import {validate} from "../../common/middleware/validate.middleware";
import {accountInformationSchema} from "./validations/account-information.schema";
import {AccountController} from "./controllers/account.controller";
import {accountPasswordSchema} from "./validations/account-password.schema";
import {accountService} from "../../config/container";

const accountController = new AccountController(accountService);

export default () => {
    const router = Router();

    router.put("/information", [
        AuthenticationMiddleware(),
        TwoFactorAuthenticationMiddleware(),
        validate(accountInformationSchema, ["first_name", "middle_name", "last_name", "address"]),
    ], accountController.information);

    router.put("/password", [
        AuthenticationMiddleware(),
        TwoFactorAuthenticationMiddleware(),
        validate(
            (req) => accountPasswordSchema(req.credentials!.jwt.uid),
            ["current_password", "new_password", "username", "email", "phone"]
        ),
    ], accountController.password);

    return router;
}