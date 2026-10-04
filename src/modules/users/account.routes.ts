// src/modules/users/account.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {TwoFactorAuthenticationMiddleware} from "../../common/middleware/two-factor-authentication.middleware";
import {validate} from "../../common/middleware/validate.middleware";
import {accountInformationSchema} from "./validations/account-information.schema";
import {AccountController} from "./controllers/account.controller";
import {AccountService} from "./services/account.service";
import {UserRepository} from "./user.repository";
import {TokenService} from "../auth/authentication/authentication-token.service";
import {accountPasswordSchema} from "./validations/account-password.schema";
import {SecurityUtil} from "../../common/utils/security.util";
import {__ENV} from "../../config/environment";

const accountController = new AccountController(new AccountService(
    new UserRepository(),
    new TokenService(),
    new SecurityUtil({
        bcryptSecret: __ENV.BCRYPT_SECRET,
        bcryptSaltRounds: Number(__ENV.BCRYPT_SALT_ROUND || 10),
    })
));

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