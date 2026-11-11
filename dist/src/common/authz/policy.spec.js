"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const policy_1 = require("./policy");
const admin = { id: 1, roleSlug: "admin", bypass: true };
const manager = { id: 2, roleSlug: "manager", bypass: false };
const customer = { id: 3, roleSlug: "customer", bypass: false };
(0, vitest_1.describe)("policy", () => {
    (0, vitest_1.describe)("can()", () => {
        (0, vitest_1.it)("allows everything for a bypassing actor", () => {
            (0, vitest_1.expect)((0, policy_1.can)(admin, policy_1.ACTIONS.DELETE, { type: "user", id: 9 })).toBe(true);
            (0, vitest_1.expect)((0, policy_1.can)(admin, policy_1.ACTIONS.UPDATE, { type: "role", id: 9 })).toBe(true);
        });
        (0, vitest_1.it)("denies administrative resources to a non-bypassing actor", () => {
            (0, vitest_1.expect)((0, policy_1.can)(manager, policy_1.ACTIONS.READ, { type: "role", id: 1 })).toBe(false);
            (0, vitest_1.expect)((0, policy_1.can)(manager, policy_1.ACTIONS.UPDATE, { type: "setting", id: 1 })).toBe(false);
            (0, vitest_1.expect)((0, policy_1.can)(manager, policy_1.ACTIONS.DELETE, { type: "route_guard", id: 1 })).toBe(false);
        });
        (0, vitest_1.it)("lets a user act on their own record", () => {
            (0, vitest_1.expect)((0, policy_1.can)(customer, policy_1.ACTIONS.UPDATE, {
                type: "user",
                id: 3,
                ownerId: 3,
            })).toBe(true);
            (0, vitest_1.expect)((0, policy_1.can)(customer, policy_1.ACTIONS.DELETE, {
                type: "user",
                id: 3,
                ownerId: 3,
            })).toBe(true);
        });
        (0, vitest_1.it)("does not let a user change another user's record", () => {
            (0, vitest_1.expect)((0, policy_1.can)(customer, policy_1.ACTIONS.UPDATE, {
                type: "user",
                id: 4,
                ownerId: 4,
            })).toBe(false);
        });
        (0, vitest_1.it)("allows creating a user", () => {
            (0, vitest_1.expect)((0, policy_1.can)(customer, policy_1.ACTIONS.CREATE, { type: "user" })).toBe(true);
        });
        (0, vitest_1.it)("denies an unknown action", () => {
            (0, vitest_1.expect)((0, policy_1.can)(customer, "unknown", { type: "user" })).toBe(false);
        });
    });
    (0, vitest_1.describe)("assertCanChangePrivilegedFields()", () => {
        (0, vitest_1.it)("allows a non-privileged field", () => {
            (0, vitest_1.expect)(() => (0, policy_1.assertCanChangePrivilegedFields)(manager, ["first_name"])).not.toThrow();
        });
        (0, vitest_1.it)("allows an administrator to change a privileged field", () => {
            (0, vitest_1.expect)(() => (0, policy_1.assertCanChangePrivilegedFields)(admin, ["role_id"])).not.toThrow();
        });
        (0, vitest_1.it)("rejects a privileged field for a non-administrator", () => {
            (0, vitest_1.expect)(() => (0, policy_1.assertCanChangePrivilegedFields)(manager, ["role_id"])).toThrow();
            (0, vitest_1.expect)(() => (0, policy_1.assertCanChangePrivilegedFields)(customer, ["status"])).toThrow();
            (0, vitest_1.expect)(() => (0, policy_1.assertCanChangePrivilegedFields)(customer, ["password"])).toThrow();
        });
        (0, vitest_1.it)("names the offending field", () => {
            (0, vitest_1.expect)(() => (0, policy_1.assertCanChangePrivilegedFields)(manager, ["role_id"])).toThrow(/role_id/);
        });
    });
    (0, vitest_1.describe)("stripPrivilegedFields()", () => {
        (0, vitest_1.it)("removes the privileged fields for a non-administrator", () => {
            const result = (0, policy_1.stripPrivilegedFields)(manager, {
                first_name: "Jane",
                role_id: 3,
                status: "Activated",
                password: "secret",
            });
            (0, vitest_1.expect)(result).toEqual({ first_name: "Jane" });
        });
        (0, vitest_1.it)("keeps the privileged fields for an administrator", () => {
            const data = { first_name: "Jane", role_id: 3 };
            (0, vitest_1.expect)((0, policy_1.stripPrivilegedFields)(admin, data)).toEqual(data);
        });
        (0, vitest_1.it)("lists the privileged fields", () => {
            (0, vitest_1.expect)(policy_1.PRIVILEGED_USER_FIELDS).toContain("role_id");
            (0, vitest_1.expect)(policy_1.PRIVILEGED_USER_FIELDS).toContain("status");
            (0, vitest_1.expect)(policy_1.PRIVILEGED_USER_FIELDS).toContain("password");
        });
    });
});
