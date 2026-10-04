// src/modules/auth/auth.routes.ts
import {Router} from "express";

import authenticationRoutes from "./authentication/authentication.routes";
import twoFactorAuthenticationRoutes from "./two-factor-authentication/two-factor-authentication.routes";
import passwordRecoveryRoutes from "./password-recovery/password-recovery.routes";

export default () => {
    const router = Router();

    router.use(authenticationRoutes());
    router.use(twoFactorAuthenticationRoutes());
    router.use(passwordRecoveryRoutes());

    return router;
};
