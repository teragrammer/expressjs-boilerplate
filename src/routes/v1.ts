// src/routes/v1.ts
import {Router} from "express";

import authRoutes from "../modules/auth/auth.routes"
import accountRoutes from "../modules/users/account.routes"
import userRoutes from "../modules/users/user.routes";
import settingRoutes from "../modules/system/settings/setting.routes";
import roleRoutes from "../modules/system/roles/role.routes";
import routeGuardRoutes from "../modules/system/route-guards/route-guard.routes";
import auditRoutes from "../modules/audit/audit.routes";

export default () => {
    const router = Router();

    router.use("/auth", authRoutes());
    router.use("/account", accountRoutes());
    router.use("/users", userRoutes());
    router.use("/settings", settingRoutes());
    router.use("/roles", roleRoutes());
    router.use("/route/guards", routeGuardRoutes());
    router.use("/audit", auditRoutes());

    return router;
}
