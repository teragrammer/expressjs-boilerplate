// src/modules/users/account.routes.ts
import {Router} from "express";
import {AuthenticationMiddleware} from "../../common/middleware/authentication.middleware";
import {idempotency} from "../../common/middleware/idempotency.middleware";
import {TwoFactorAuthenticationMiddleware} from "../../common/middleware/two-factor-authentication.middleware";
import {validate} from "../../common/middleware/validate.middleware";
import {accountInformationSchema} from "./account-information.schema";
import {accountPasswordSchema} from "./account-password.schema";
import {accountController} from "../../config/container";
import verificationRoutes from "../auth/verification/verification.routes";

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
        validate(accountInformationSchema, ["first_name", "middle_name", "last_name", "address"]),
        idempotency({scope: "account:information"}),
    ], accountController.information);

    router.put("/password", [
        AuthenticationMiddleware(),
        TwoFactorAuthenticationMiddleware(),
        validate(
            (req) => accountPasswordSchema(req.credentials!.jwt.uid),
            ["current_password", "new_password", "username", "email", "phone"]
        ),
        idempotency({scope: "account:password"}),
    ], accountController.password);

    return router;
};
