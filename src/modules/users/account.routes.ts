// src/modules/users/account.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {idempotency} from "../../common/middleware/idempotency.middleware";
import {TwoFactorAuthenticationMiddleware} from "../../common/middleware/two-factor-authentication.middleware";
import {validate} from "../../common/middleware/validate.middleware";
import {accountInformationSchema} from "./validations/account-information.schema";
import {AccountController} from "./controllers/account.controller";
import {accountPasswordSchema} from "./validations/account-password.schema";
import {accountService} from "../../config/container";
import verificationRoutes from "../auth/verification/verification.routes";

const accountController = new AccountController(accountService);

export default () => {
    const router = Router();

    /*
     * Verification endpoints live under /account because they operate
     * on the caller's own contact details.
     */
    router.use(verificationRoutes());

    router.put("/information", [
        AuthenticationMiddleware(),
        TwoFactorAuthenticationMiddleware(),
        idempotency({scope: "account:information"}),
        validate(accountInformationSchema, ["first_name", "middle_name", "last_name", "address"]),
    ], accountController.information);

    router.put("/password", [
        AuthenticationMiddleware(),
        TwoFactorAuthenticationMiddleware(),
        idempotency({scope: "account:password"}),
        validate(
            (req) => accountPasswordSchema(req.credentials!.jwt.uid),
            ["current_password", "new_password", "username", "email", "phone"]
        ),
    ], accountController.password);

    return router;
}