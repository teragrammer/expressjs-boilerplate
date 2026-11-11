"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/v1.ts
const express_1 = require("express");
const auth_routes_1 = __importDefault(require("../modules/auth/auth.routes"));
const account_routes_1 = __importDefault(require("../modules/users/account.routes"));
const user_routes_1 = __importDefault(require("../modules/users/user.routes"));
const setting_routes_1 = __importDefault(require("../modules/system/settings/setting.routes"));
const role_routes_1 = __importDefault(require("../modules/system/roles/role.routes"));
const route_guard_routes_1 = __importDefault(require("../modules/system/route-guards/route-guard.routes"));
const audit_routes_1 = __importDefault(require("../modules/audit/audit.routes"));
exports.default = () => {
    const router = (0, express_1.Router)();
    router.use("/auth", (0, auth_routes_1.default)());
    router.use("/account", (0, account_routes_1.default)());
    router.use("/users", (0, user_routes_1.default)());
    router.use("/settings", (0, setting_routes_1.default)());
    router.use("/roles", (0, role_routes_1.default)());
    router.use("/route/guards", (0, route_guard_routes_1.default)());
    router.use("/audit", (0, audit_routes_1.default)());
    return router;
};
