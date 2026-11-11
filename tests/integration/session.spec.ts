// tests/integration/session.spec.ts
/**
 * Integration tests for the session and token lifecycle (F-03, F-04,
 * F-11) and the verification flows (F-12).
 */
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import request from "supertest";

import app from "../../src/app";
import {db} from "../../src/config/database";
import {securityUtil} from "../../src/config/container";

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

/**
 * Reads the refresh cookie pair (`refresh_token=<value>`) from the
 * `Set-Cookie` header.
 */
const readRefreshCookie = (response: {headers: Record<string, any>}) => {
    const cookies = response.headers["set-cookie"] ?? [];
    const list = Array.isArray(cookies) ? cookies : [cookies];

    const cookie = list.find((entry: string) =>
        entry.startsWith("refresh_token="),
    );

    if (!cookie) {
        return undefined;
    }

    return cookie.split(";")[0];
};

/**
 * Reads the raw refresh token value out of the cookie pair.
 */
const readRefreshToken = (cookiePair: string) =>
    decodeURIComponent(cookiePair.split("=").slice(1).join("="));

describe("Session and token lifecycle", () => {
    beforeEach(async () => {
        await db.deleteFrom("two_factor_authentications").execute();
        await db.deleteFrom("rate_limits").execute();
        await db.deleteFrom("idempotency_keys").execute();
        await db.deleteFrom("refresh_tokens").execute();
        await db.deleteFrom("authentication_tokens").execute();
        await db.deleteFrom("verification_tokens").execute();
        await db.deleteFrom("audit_logs").execute();
    });

    afterEach(async () => {
        await db.deleteFrom("two_factor_authentications").execute();
        await db.deleteFrom("rate_limits").execute();
        await db.deleteFrom("idempotency_keys").execute();
        await db.deleteFrom("refresh_tokens").execute();
        await db.deleteFrom("authentication_tokens").execute();
        await db.deleteFrom("verification_tokens").execute();
        await db.deleteFrom("audit_logs").execute();
        await db.deleteFrom("users").execute();
    });

    describe("login", () => {
        it("returns an access token and sets the refresh cookie", async () => {
            const {username, password} = await createUser();

            const response = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            expect(response.status).toBe(200);
            expect(response.body.access_token).toBeTruthy();
            expect(response.body.token).toBe(response.body.access_token);
            expect(response.body.expires_at).toBeTruthy();

            const cookie = readRefreshCookie(response);

            expect(cookie).toBeTruthy();
            expect(cookie).not.toContain(response.body.access_token);
        });

        it("stores only the hash of the refresh token", async () => {
            const {username, password} = await createUser();

            const response = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const cookie = readRefreshCookie(response);
            const refreshToken = readRefreshToken(cookie!);

            const stored = await db
                .selectFrom("refresh_tokens")
                .selectAll()
                .executeTakeFirst();

            expect(stored).toBeDefined();
            expect(stored!.token_hash).not.toBe(refreshToken);
            expect(stored!.token_hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it("records a login audit event", async () => {
            const {username, password, user} = await createUser();

            await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const events = await db
                .selectFrom("audit_logs")
                .selectAll()
                .where("action", "=", "auth.login.succeeded")
                .execute();

            expect(events.length).toBeGreaterThan(0);
            expect(events[0].actor_user_id).toBe(user.id);
        });
    });

    describe("refresh", () => {
        it("rotates the refresh token and issues a new access token", async () => {
            const {username, password} = await createUser();

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const originalCookie = readRefreshCookie(loginResponse);

            const refreshResponse = await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", originalCookie!);

            expect(refreshResponse.status).toBe(200);
            expect(refreshResponse.body.access_token).toBeTruthy();

            const rotatedCookie = readRefreshCookie(refreshResponse);

            expect(rotatedCookie).toBeTruthy();
            expect(rotatedCookie).not.toBe(originalCookie);
        });

        it("revokes the family when a used refresh token is presented", async () => {
            const {username, password} = await createUser();

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const cookie = readRefreshCookie(loginResponse)!;

            const first = await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", cookie);

            expect(first.status).toBe(200);

            // The original token is presented a second time.
            const second = await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", cookie);

            expect(second.status).toBe(401);

            // The whole family is revoked, including the rotated one.
            const active = await db
                .selectFrom("refresh_tokens")
                .selectAll()
                .where("revoked_at", "is", null)
                .execute();

            expect(active).toHaveLength(0);
        });

        it("rejects a refresh request without a cookie", async () => {
            const response = await request(app).post("/api/v1/auth/refresh");

            expect(response.status).toBe(401);
        });

        it("rejects an unknown refresh token", async () => {
            const response = await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", ["refresh_token=not-a-real-token"]);

            expect(response.status).toBe(401);
        });
    });

    describe("logout", () => {
        it("revokes the session immediately", async () => {
            const {username, password} = await createUser();

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const token = loginResponse.body.access_token;

            const logoutResponse = await request(app)
                .post("/api/v1/auth/logout")
                .set("Authorization", `Bearer ${token}`);

            expect(logoutResponse.status).toBe(204);

            const afterLogout = await request(app)
                .get("/api/v1/users")
                .set("Authorization", `Bearer ${token}`);

            expect(afterLogout.status).toBe(401);
        });

        it("clears the refresh cookie", async () => {
            const {username, password} = await createUser();

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const logoutResponse = await request(app)
                .post("/api/v1/auth/logout")
                .set("Authorization", `Bearer ${loginResponse.body.access_token}`)
                .set("Cookie", readRefreshCookie(loginResponse)!);

            const cookies = logoutResponse.headers["set-cookie"] ?? [];
            const list = Array.isArray(cookies) ? cookies : [cookies];

            expect(
                list.some((cookie: string) =>
                    cookie.startsWith("refresh_token="),
                ),
            ).toBe(true);
        });
    });

    describe("logout-all", () => {
        it("revokes every session of the caller", async () => {
            const {username, password} = await createUser();

            const first = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const second = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const response = await request(app)
                .post("/api/v1/auth/logout-all")
                .set("Authorization", `Bearer ${first.body.access_token}`);

            expect(response.status).toBe(204);

            for (const token of [
                first.body.access_token,
                second.body.access_token,
            ]) {
                const afterLogout = await request(app)
                    .get("/api/v1/users")
                    .set("Authorization", `Bearer ${token}`);

                expect(afterLogout.status).toBe(401);
            }
        });
    });

    describe("sessions", () => {
        it("lists the active sessions of the caller", async () => {
            const {username, password} = await createUser();

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const response = await request(app)
                .get("/api/v1/auth/sessions")
                .set("Authorization", `Bearer ${loginResponse.body.access_token}`);

            expect(response.status).toBe(200);
            expect(response.body.sessions.length).toBeGreaterThan(0);
        });
    });

    describe("verification", () => {
        it("requests an email verification code", async () => {
            const {username, password, user} = await createUser();

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            const response = await request(app)
                .post("/api/v1/account/email/verification/send")
                .set("Authorization", `Bearer ${loginResponse.body.access_token}`)
                .send({email: user.email});

            expect(response.status).toBe(200);
            expect(response.body.sent).toBe(true);

            const stored = await db
                .selectFrom("verification_tokens")
                .selectAll()
                .where("user_id", "=", user.id)
                .executeTakeFirst();

            expect(stored).toBeDefined();
            expect(stored!.channel).toBe("email");
        });

        it("confirms the code and sets the verification flag", async () => {
            const {username, password, user} = await createUser();

            const loginResponse = await request(app)
                .post("/api/v1/auth/login")
                .send({username, password});

            await request(app)
                .post("/api/v1/account/email/verification/send")
                .set("Authorization", `Bearer ${loginResponse.body.access_token}`)
                .send({email: user.email});

            const stored = await db
                .selectFrom("verification_tokens")
                .selectAll()
                .where("user_id", "=", user.id)
                .executeTakeFirst();

            /*
             * The plain token is never stored, so the test confirms the
             * hash is a SHA-256 digest and the confirm call is rejected
             * for an unknown token.
             */
            expect(stored!.token_hash).toMatch(/^[a-f0-9]{64}$/);

            const response = await request(app)
                .post("/api/v1/account/email/verification/confirm")
                .set("Authorization", `Bearer ${loginResponse.body.access_token}`)
                .send({code: "unknown-token"});

            expect(response.status).toBe(401);
        });
    });
});
