"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUDIT_ACTIONS = void 0;
// src/modules/audit/audit.interface.ts
/**
 * Audit event taxonomy.
 *
 * The list is intentionally small and explicit: every event maps to a
 * security-relevant or administrative state change.
 */
exports.AUDIT_ACTIONS = {
    AUTH_LOGIN_SUCCEEDED: "auth.login.succeeded",
    AUTH_LOGIN_FAILED: "auth.login.failed",
    AUTH_LOGOUT: "auth.logout",
    AUTH_LOGOUT_ALL: "auth.logout.all",
    AUTH_TOKEN_REFRESHED: "auth.token.refreshed",
    AUTH_TOKEN_REUSE_DETECTED: "auth.token.reuse_detected",
    AUTH_PASSWORD_RESET: "auth.password.reset",
    AUTH_PASSWORD_CHANGED: "auth.password.changed",
    AUTH_RECOVERY_REQUESTED: "auth.recovery.requested",
    AUTH_TFA_ENABLED: "auth.tfa.enabled",
    AUTH_TFA_DISABLED: "auth.tfa.disabled",
    AUTH_TFA_VERIFIED: "auth.tfa.verified",
    USER_CREATED: "user.created",
    USER_UPDATED: "user.updated",
    USER_DELETED: "user.deleted",
    USER_ROLE_CHANGED: "user.role.changed",
    USER_STATUS_CHANGED: "user.status.changed",
    ROLE_CREATED: "role.created",
    ROLE_UPDATED: "role.updated",
    ROLE_DELETED: "role.deleted",
    PERMISSION_CHANGED: "permission.changed",
    SETTING_CREATED: "setting.created",
    SETTING_UPDATED: "setting.updated",
    SETTING_DELETED: "setting.deleted",
    RATE_LIMIT_EXCEEDED: "security.rate_limit.exceeded",
    AUTHORIZATION_DENIED: "security.authorization.denied",
};
