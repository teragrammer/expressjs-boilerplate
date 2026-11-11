import {describe, expect, it} from "vitest";
import {
    ACTIONS,
    Actor,
    assertCanChangePrivilegedFields,
    can,
    PRIVILEGED_USER_FIELDS,
    stripPrivilegedFields,
} from "./policy";

const admin: Actor = {id: 1, roleSlug: "admin", bypass: true};
const manager: Actor = {id: 2, roleSlug: "manager", bypass: false};
const customer: Actor = {id: 3, roleSlug: "customer", bypass: false};

describe("policy", () => {
    describe("can()", () => {
        it("allows everything for a bypassing actor", () => {
            expect(
                can(admin, ACTIONS.DELETE, {type: "user", id: 9}),
            ).toBe(true);
            expect(
                can(admin, ACTIONS.UPDATE, {type: "role", id: 9}),
            ).toBe(true);
        });

        it("denies administrative resources to a non-bypassing actor", () => {
            expect(
                can(manager, ACTIONS.READ, {type: "role", id: 1}),
            ).toBe(false);
            expect(
                can(manager, ACTIONS.UPDATE, {type: "setting", id: 1}),
            ).toBe(false);
            expect(
                can(manager, ACTIONS.DELETE, {type: "route_guard", id: 1}),
            ).toBe(false);
        });

        it("lets a user act on their own record", () => {
            expect(
                can(customer, ACTIONS.UPDATE, {
                    type: "user",
                    id: 3,
                    ownerId: 3,
                }),
            ).toBe(true);
            expect(
                can(customer, ACTIONS.DELETE, {
                    type: "user",
                    id: 3,
                    ownerId: 3,
                }),
            ).toBe(true);
        });

        it("does not let a user change another user's record", () => {
            expect(
                can(customer, ACTIONS.UPDATE, {
                    type: "user",
                    id: 4,
                    ownerId: 4,
                }),
            ).toBe(false);
        });

        it("allows creating a user", () => {
            expect(can(customer, ACTIONS.CREATE, {type: "user"})).toBe(true);
        });

        it("denies an unknown action", () => {
            expect(
                can(customer, "unknown" as never, {type: "user"}),
            ).toBe(false);
        });
    });

    describe("assertCanChangePrivilegedFields()", () => {
        it("allows a non-privileged field", () => {
            expect(() =>
                assertCanChangePrivilegedFields(manager, ["first_name"]),
            ).not.toThrow();
        });

        it("allows an administrator to change a privileged field", () => {
            expect(() =>
                assertCanChangePrivilegedFields(admin, ["role_id"]),
            ).not.toThrow();
        });

        it("rejects a privileged field for a non-administrator", () => {
            expect(() =>
                assertCanChangePrivilegedFields(manager, ["role_id"]),
            ).toThrow();
            expect(() =>
                assertCanChangePrivilegedFields(customer, ["status"]),
            ).toThrow();
            expect(() =>
                assertCanChangePrivilegedFields(customer, ["password"]),
            ).toThrow();
        });

        it("names the offending field", () => {
            expect(() =>
                assertCanChangePrivilegedFields(manager, ["role_id"]),
            ).toThrow(/role_id/);
        });
    });

    describe("stripPrivilegedFields()", () => {
        it("removes the privileged fields for a non-administrator", () => {
            const result = stripPrivilegedFields(manager, {
                first_name: "Jane",
                role_id: 3,
                status: "Activated",
                password: "secret",
            });

            expect(result).toEqual({first_name: "Jane"});
        });

        it("keeps the privileged fields for an administrator", () => {
            const data = {first_name: "Jane", role_id: 3};

            expect(stripPrivilegedFields(admin, data)).toEqual(data);
        });

        it("lists the privileged fields", () => {
            expect(PRIVILEGED_USER_FIELDS).toContain("role_id");
            expect(PRIVILEGED_USER_FIELDS).toContain("status");
            expect(PRIVILEGED_USER_FIELDS).toContain("password");
        });
    });
});
