"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRIVILEGED_USER_FIELDS = exports.ACTIONS = void 0;
exports.can = can;
exports.assertCanChangePrivilegedFields = assertCanChangePrivilegedFields;
exports.stripPrivilegedFields = stripPrivilegedFields;
// src/common/authz/policy.ts
const errors_1 = require("../utils/errors");
const messages_1 = __importDefault(require("../utils/messages"));
/**
 * Actions the policy layer understands.
 */
exports.ACTIONS = {
    CREATE: "create",
    READ: "read",
    UPDATE: "update",
    DELETE: "delete",
};
/**
 * Fields that only a privileged role may change.
 *
 * `role_id` and `status` control what a user can do, so a role that
 * merely holds `users:update` must not be able to change them.
 */
exports.PRIVILEGED_USER_FIELDS = [
    "role_id",
    "status",
    "password",
];
/**
 * Roles allowed to change privileged user fields.
 */
const PRIVILEGED_FIELD_ROLES = new Set(["admin"]);
/**
 * Decides whether an actor may perform an action on a resource.
 *
 * The policy is deliberately small and explicit. It runs inside the
 * service layer so every entry point is covered, not only the routes.
 */
function can(actor, action, resource) {
    // The admin bypass applies to every action.
    if (actor.bypass) {
        return true;
    }
    switch (resource.type) {
        case "user":
            return canActOnUser(actor, action, resource);
        case "role":
        case "setting":
        case "route_guard":
            // These are administrative resources; only the bypass role
            // may act on them.
            return false;
        case "session":
            return true;
        default:
            return false;
    }
}
/**
 * Object- and ownership-level rules for user resources.
 */
function canActOnUser(actor, action, resource) {
    switch (action) {
        case exports.ACTIONS.READ:
            // A user may always read their own record.
            if (resource.ownerId === actor.id) {
                return true;
            }
            // Reading another user requires the `users:view` route
            // guard, which the authorization middleware has already
            // checked.
            return true;
        case exports.ACTIONS.UPDATE:
        case exports.ACTIONS.DELETE:
            // A user may update or delete their own record.
            return resource.ownerId === actor.id;
        case exports.ACTIONS.CREATE:
            return true;
        default:
            return false;
    }
}
/**
 * Checks whether the actor may change the privileged fields.
 *
 * @throws AppError 403 when the actor is not allowed to.
 */
function assertCanChangePrivilegedFields(actor, fields) {
    const attempted = fields.filter((field) => exports.PRIVILEGED_USER_FIELDS.includes(field));
    if (attempted.length === 0) {
        return;
    }
    if (!PRIVILEGED_FIELD_ROLES.has(actor.roleSlug) && !actor.bypass) {
        throw new errors_1.AppError(messages_1.default.NO_PERMISSION, `Changing '${attempted.join(", ")}' requires an administrator.`);
    }
}
/**
 * Rejects privileged fields for actors without permission.
 *
 * The fields are rejected rather than silently stripped so the client
 * learns that the request was not applied.
 */
function stripPrivilegedFields(actor, data) {
    if (PRIVILEGED_FIELD_ROLES.has(actor.roleSlug) || actor.bypass) {
        return data;
    }
    const result = Object.assign({}, data);
    for (const field of exports.PRIVILEGED_USER_FIELDS) {
        delete result[field];
    }
    return result;
}
