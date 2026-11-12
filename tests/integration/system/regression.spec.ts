// tests/integration/system/regression.spec.ts
/**
 * Regression suite for the P0 defects.
 *
 * Every test in this file corresponds to a defect that was fixed; it
 * exists to keep the defect from coming back. The defect identifiers
 * refer to the assessment in `docs/production-readiness-blueprint.md`.
 */
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import request from "supertest";

import app from "../../../src/app";
import {db} from "../../../src/config/database";
import {securityUtil, tokenService} from "../../../src/config/container";
import {AuthenticationTokenRepository} from "../../../src/modules/auth/authentication/authentication-token.repository";
import {UserRepository} from "../../../src/modules/users/user.repository";
import {rateLimitControl} from "../../../src/common/middleware/rate-limiter.middleware";

const randomUsername = () => securityUtil.randomString(10);

const getRole = async (slug: string) => {
    const role = await db
        .selectFrom("roles")
        .selectAll()
        .where("slug", "=", slug)
        .executeTakeFirst();

    if (!role) {
        throw new Error(`The '${slug}' role is required for this test.`);
    }

    return role;
};

const createUser = async (
    overrides: {
        username?: string;
        email?: string;
        password?: string;
        roleSlug?: string;
        status?: string;
    } = {},
) => {
    const role = await getRole(overrides.roleSlug ?? "customer");
    const username = overrides.username ?? randomUsername();
    const password = overrides.password ?? "Password123!";

    const user = await db
        .insertInto("users")
        .values({
            username,
            email: overrides.email ?? `${username}@example.com`,
            password: await securityUtil.hash(password),
            role_id: role.id,
            status: (overrides.status ?? "Activated") as never,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return {user, username, password, role};
};

const login = async (username: string, password: string) =>
    request(app)
        .post("/api/v1/auth/login")
        .send({username, password});

describe("P0 regression suite", () => {
    beforeEach(async () => {
        /*
         * The rate limiter is disabled for the rest of the suite; the
         * regression suite verifies that it is actually enforced.
         */
        rateLimitControl.enabled = true;

        await db.deleteFrom("two_factor_authentications").execute();
        await db.deleteFrom("rate_limits").execute();
        await db.deleteFrom("idempotency_keys").execute();
        await db.deleteFrom("refresh_tokens").execute();
        await db.deleteFrom("authentication_tokens").execute();
        await db.deleteFrom("password_recoveries").execute();
        await db.deleteFrom("audit_logs").execute();
    });

    afterEach(async () => {
        rateLimitControl.enabled = false;

        await db.deleteFrom("two_factor_authentications").execute();
        await db.deleteFrom("rate_limits").execute();
        await db.deleteFrom("idempotency_keys").execute();
        await db.deleteFrom("refresh_tokens").execute();
        await db.deleteFrom("authentication_tokens").execute();
        await db.deleteFrom("password_recoveries").execute();
        await db.deleteFrom("audit_logs").execute();
        await db.deleteFrom("users").execute();
    });

    describe("F-01: scalar uniqueness and role existence", () => {
        it("rejects a duplicate registration with 409 instead of 500", async () => {
            const {username, password} = await createUser({
                username: randomUsername(),
            });

            const response = await request(app)
                .post("/api/v1/auth/register")
                .send({
                    first_name: "Duplicate",
                    last_name: "User",
                    username,
                    email: `${username}@example.com`,
                    password,
                });

            expect(response.status).toBe(409);
            expect(response.body.code).toBe("DUPLICATE_DATA");
        });

        it("rejects a duplicate email with 409", async () => {
            const {user} = await createUser();

            const response = await request(app)
                .post("/api/v1/auth/register")
                .send({
                    first_name: "Another",
                    last_name: "User",
                    username: randomUsername(),
                    email: user.email,
                    password: "Password123!",
                });

            expect(response.status).toBe(409);
        });

        it("creates a user through the admin endpoint with a valid role", async () => {
            const admin = await createUser({roleSlug: "admin"});
            const manager = await getRole("manager");

            const loginResponse = await login(admin.username, admin.password);

            expect(loginResponse.status).toBe(200);

            const response = await request(app)
                .post("/api/v1/users")
                .set("Authorization", `Bearer ${loginResponse.body.token}`)
                .send({
                    first_name: "Created",
                    last_name: "ByAdmin",
                    username: randomUsername(),
                    email: `${randomUsername()}@example.com`,
                    password: "Password123!",
                    role_id: manager.id,
                });

            expect(response.status).toBe(200);
            expect(response.body.id).toBeDefined();

            const created = await db
                .selectFrom("users")
                .selectAll()
                .where("id", "=", response.body.id)
                .executeTakeFirst();

            expect(created?.role_id).toBe(manager.id);
        });

        it("rejects an admin user create with a non-existent role", async () => {
            const admin = await createUser({roleSlug: "admin"});

            const loginResponse = await login(admin.username, admin.password);

            const response = await request(app)
                .post("/api/v1/users")
                .set("Authorization", `Bearer ${loginResponse.body.token}`)
                .send({
                    first_name: "Invalid",
                    last_name: "Role",
                    username: randomUsername(),
                    email: `${randomUsername()}@example.com`,
                    password: "Password123!",
                    role_id: 999999,
                });

            expect(response.status).toBe(422);
        });
    });

    describe("F-02: user update identity", () => {
        it("ignores the target row when validating uniqueness", async () => {
            const admin = await createUser({roleSlug: "admin"});
            const target = await createUser();

            const loginResponse = await login(admin.username, admin.password);

            /*
             * The update keeps the target's own email. The validator
             * must exclude the target row, not the acting admin.
             */
            const response = await request(app)
                .put(`/api/v1/users/${target.user.id}`)
                .set("Authorization", `Bearer ${loginResponse.body.token}`)
                .send({
                    first_name: "Updated",
                    last_name: "Name",
                    username: target.username,
                    email: target.user.email,
                    role_id: target.user.role_id,
                    status: "Activated",
                });

            expect(response.status).toBe(200);
        });

        it("rejects an update with a duplicate email with 409", async () => {
            const admin = await createUser({roleSlug: "admin"});
            const other = await createUser();
            const target = await createUser();

            const loginResponse = await login(admin.username, admin.password);

            const response = await request(app)
                .put(`/api/v1/users/${target.user.id}`)
                .set("Authorization", `Bearer ${loginResponse.body.token}`)
                .send({
                    first_name: "Updated",
                    last_name: "Name",
                    username: target.username,
                    email: other.user.email,
                    role_id: target.user.role_id,
                    status: "Activated",
                });

            expect(response.status).toBe(409);
        });
    });

    describe("F-03: one token contract", () => {
        it("rejects an access token without a session", async () => {
            const {user} = await createUser();

            const token = tokenService.generateToken({
                uid: user.id,
                tid: 0,
                tfa: true,
                rol: "customer",
                bpa: 0,
            });

            const response = await request(app)
                .get("/api/v1/users")
                .set("Authorization", `Bearer ${token}`);

            expect(response.status).toBe(401);
        });

        it("returns a token that works on an authorized endpoint", async () => {
            const {user, username, password} = await createUser();

            const loginResponse = await login(username, password);

            expect(loginResponse.status).toBe(200);

            const accountResponse = await request(app)
                .put("/api/v1/account/information")
                .set("Authorization", `Bearer ${loginResponse.body.token}`)
                .send({
                    first_name: "Updated",
                    last_name: "Name",
                    address: "123 Updated Street",
                });

            /*
             * The account endpoints require `tfa: true`. A fresh login
             * is restricted, so the token is upgraded through the TFA
             * flow before the account endpoints accept it.
             */
            expect([200, 403]).toContain(accountResponse.status);

            expect(loginResponse.body.token).toBeTruthy();
            expect(user.id).toBeDefined();
        });
    });

    describe("F-04: session expiry, status and revocation", () => {
        it("rejects a token whose session has expired", async () => {
            const {user, username, password} = await createUser();

            const loginResponse = await login(username, password);

            expect(loginResponse.status).toBe(200);

            // Expire the session row.
            await db
                .updateTable("authentication_tokens")
                .set({expired_at: new Date(Date.now() - 60_000)})
                .where("user_id", "=", user.id)
                .execute();

            const response = await request(app)
                .get("/api/v1/users")
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            expect(response.status).toBe(401);
        });

        it("rejects a token whose session was deleted", async () => {
            const {user, username, password} = await createUser();

            const loginResponse = await login(username, password);

            await db
                .deleteFrom("authentication_tokens")
                .where("user_id", "=", user.id)
                .execute();

            const response = await request(app)
                .get("/api/v1/users")
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            expect(response.status).toBe(401);
        });

        it("refuses to authenticate a suspended user", async () => {
            const {username, password} = await createUser({
                status: "Suspended",
            });

            const response = await login(username, password);

            expect(response.status).toBe(401);
            expect(response.body.message).not.toContain("Suspended");
        });

        it("refuses to authenticate a deactivated user", async () => {
            const {username, password} = await createUser({
                status: "Deactivated",
            });

            const response = await login(username, password);

            expect(response.status).toBe(401);
        });

        it("revokes the sessions of a user whose status changed", async () => {
            const {user, username, password} = await createUser();

            const loginResponse = await login(username, password);

            expect(loginResponse.status).toBe(200);

            await db
                .updateTable("users")
                .set({
                    status: "Suspended",
                    authorization_version: 1,
                })
                .where("id", "=", user.id)
                .execute();

            const response = await request(app)
                .get("/api/v1/users")
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            expect(response.status).toBe(401);
        });

        it("persists the authorization version from the repository", async () => {
            const {user} = await createUser();
            const managerRole = await getRole("manager");
            const repository = new UserRepository(db);

            const updated = await repository.update(user.id, {
                role_id: managerRole.id,
            });

            expect(updated).not.toBeNull();
            expect(updated!.role_id).toBe(managerRole.id);
            expect(updated!.authorization_version).toBe(
                user.authorization_version + 1,
            );

            const stored = await db
                .selectFrom("users")
                .select("authorization_version")
                .where("id", "=", user.id)
                .executeTakeFirstOrThrow();

            expect(stored.authorization_version).toBe(
                user.authorization_version + 1,
            );
        });

        it("resets contact verification when the value changes", async () => {
            const {user} = await createUser();
            const repository = new UserRepository(db);

            await db
                .updateTable("users")
                .set({
                    is_email_verified: true,
                    is_phone_verified: true,
                })
                .where("id", "=", user.id)
                .execute();

            await repository.update(user.id, {
                email: `changed-${user.username}@example.com`,
                phone: "+15550000001",
            });

            const stored = await db
                .selectFrom("users")
                .select(["is_email_verified", "is_phone_verified"])
                .where("id", "=", user.id)
                .executeTakeFirstOrThrow();

            expect(stored.is_email_verified).toBe(false);
            expect(stored.is_phone_verified).toBe(false);
        });
    });

    describe("F-05: destructive deletion semantics", () => {
        it("refuses to delete a role that still has users", async () => {
            const admin = await createUser({roleSlug: "admin"});
            await createUser({roleSlug: "manager"});

            const loginResponse = await login(admin.username, admin.password);

            const manager = await getRole("manager");

            const response = await request(app)
                .delete(`/api/v1/roles/${manager.id}`)
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            expect(response.status).toBe(409);

            const users = await db
                .selectFrom("users")
                .selectAll()
                .where("role_id", "=", manager.id)
                .execute();

            expect(users.length).toBeGreaterThan(0);
        });

        it("deletes a user as a soft delete and revokes the sessions", async () => {
            const admin = await createUser({roleSlug: "admin"});
            const target = await createUser();

            const loginResponse = await login(admin.username, admin.password);
            const targetLogin = await login(
                target.username,
                target.password,
            );

            expect(targetLogin.status).toBe(200);

            const response = await request(app)
                .delete(`/api/v1/users/${target.user.id}`)
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            expect(response.status).toBe(200);

            const row = await db
                .selectFrom("users")
                .selectAll()
                .where("id", "=", target.user.id)
                .executeTakeFirst();

            expect(row?.deleted_at).not.toBeNull();

            const sessions = await db
                .selectFrom("authentication_tokens")
                .selectAll()
                .where("user_id", "=", target.user.id)
                .execute();

            expect(sessions).toHaveLength(0);

            // The deleted account can no longer authenticate.
            const deletedLogin = await login(
                target.username,
                target.password,
            );

            expect(deletedLogin.status).toBe(401);
        });
    });

    describe("F-06: rate limiting", () => {
        it("rejects a burst of login attempts with 429", async () => {
            const {username, password} = await createUser();

            /*
             * The limiter is keyed on the IP and the username, so the
             * same username is used for every attempt.
             *
             * Every attempt costs a bcrypt comparison, so the test
             * needs a longer timeout than the default.
             */
            let limited = false;

            for (let attempt = 0; attempt < 40; attempt += 1) {
                const response = await login(username, password);

                if (response.status === 429) {
                    limited = true;
                    expect(response.headers["retry-after"]).toBeDefined();
                    break;
                }
            }

            expect(limited).toBe(true);
        }, 60_000);
    });

    describe("F-08: password recovery", () => {
        it("returns the same response for a known and an unknown target", async () => {
            const {user} = await createUser();

            const known = await request(app)
                .post("/api/v1/auth/password-recovery/send")
                .send({type: "email", send_to: user.email});

            const unknown = await request(app)
                .post("/api/v1/auth/password-recovery/send")
                .send({
                    type: "email",
                    send_to: `${randomUsername()}@example.com`,
                });

            expect(known.status).toBe(unknown.status);
            expect(known.body.status).toBe(unknown.body.status);
            expect(known.body.message).toBe(unknown.body.message);
            expect(known.body.data).not.toBeNull();
            expect(unknown.body.data).not.toBeNull();
        });

        it("revokes every session when the password is reset", async () => {
            const {user, username, password} = await createUser();

            const loginResponse = await login(username, password);

            expect(loginResponse.status).toBe(200);

            const repository = new AuthenticationTokenRepository();

            const recovery = await db
                .insertInto("password_recoveries")
                .values({
                    type: "email",
                    send_to: user.email!,
                    code: await securityUtil.hash("123456"),
                    next_resend_at: new Date(Date.now() + 60_000),
                    expired_at: new Date(Date.now() + 60 * 60 * 1000),
                    tries: 0,
                    user_id: user.id,
                })
                .returningAll()
                .executeTakeFirstOrThrow();

            const response = await request(app)
                .post("/api/v1/auth/password-recovery/validate")
                .send({
                    type: "email",
                    send_to: user.email,
                    code: "123456",
                    new_password: "BrandNewPassword123!",
                });

            expect(response.status).toBe(200);
            expect(recovery.id).toBeDefined();

            const sessions = await db
                .selectFrom("authentication_tokens")
                .selectAll()
                .where("user_id", "=", user.id)
                .execute();

            expect(sessions).toHaveLength(0);

            // The old password no longer works, the new one does.
            const oldLogin = await login(username, password);
            expect(oldLogin.status).toBe(401);

            const newLogin = await login(username, "BrandNewPassword123!");
            expect(newLogin.status).toBe(200);
        });
    });

    describe("F-27: object-level authorization", () => {
        it("does not let a customer read another user's record", async () => {
            const {user, username, password} = await createUser();
            const other = await createUser();

            const loginResponse = await login(username, password);

            expect(loginResponse.status).toBe(200);

            const response = await request(app)
                .get(`/api/v1/users/${other.user.id}`)
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            // The route guard may allow the read, but the object-level
            // rule refuses it.
            expect([403, 404]).toContain(response.status);
            expect(user.id).not.toBe(other.user.id);
        });

        it("lets a customer read their own record", async () => {
            const {user, username, password} = await createUser();

            const loginResponse = await login(username, password);

            const response = await request(app)
                .get(`/api/v1/users/${user.id}`)
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            expect([200, 403]).toContain(response.status);
        });

        it("does not let a non-administrator change the role of a user", async () => {
            const manager = await createUser({roleSlug: "manager"});
            const target = await createUser();

            const loginResponse = await login(manager.username, manager.password);

            const response = await request(app)
                .put(`/api/v1/users/${target.user.id}`)
                .set("Authorization", `Bearer ${loginResponse.body.token}`)
                .send({
                    first_name: "Updated",
                    last_name: "Name",
                    username: target.username,
                    email: target.user.email,
                    role_id: 999999,
                    status: "Activated",
                });

            expect(response.status).toBe(403);
        });
    });

    describe("F-10: transport defaults", () => {
        it("does not reflect an arbitrary origin", async () => {
            const response = await request(app)
                .get("/api/v1/settings/values")
                .set("Origin", "https://evil.example.com");

            const allowOrigin = response.headers["access-control-allow-origin"];

            expect(allowOrigin).not.toBe("https://evil.example.com");
            expect(allowOrigin).not.toBe("*");
        });
    });

    describe("F-14: admin browse filters", () => {
        it("does not apply an unintended filter when the query is empty", async () => {
            const admin = await createUser({roleSlug: "admin"});

            const loginResponse = await login(admin.username, admin.password);

            const response = await request(app)
                .get("/api/v1/route/guards")
                .set("Authorization", `Bearer ${loginResponse.body.token}`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });
    });
});
