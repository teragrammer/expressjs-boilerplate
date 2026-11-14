// tests/integration/system/security-fixes.spec.ts
/**
 * Regression coverage for the security assessment in `audit.md`.
 *
 * Each test exercises the vulnerable behaviour through the same
 * interface an attacker would use, rather than only asserting that a
 * helper was called.
 */
import {createHash, randomUUID} from "node:crypto";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import request from "supertest";
import sgMail from "@sendgrid/mail";

import app from "../../../src/app";
import {db} from "../../../src/config/database";
import {
    securityUtil,
    settingService,
    tokenService,
} from "../../../src/config/container";
import {rateLimitControl} from "../../../src/common/middleware/rate-limiter.middleware";
import {RoleRepository} from "../../../src/modules/system/roles/role.repository";

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
        roleId?: number;
        hasTfa?: boolean;
    } = {},
) => {
    const roleId =
        overrides.roleId ?? (await getRole(overrides.roleSlug ?? "customer")).id;
    const username = overrides.username ?? randomUsername();
    const password = overrides.password ?? "Password123!";

    const user = await db
        .insertInto("users")
        .values({
            username,
            email: overrides.email ?? `${username}@example.com`,
            password: await securityUtil.hash(password),
            role_id: roleId,
            status: "Activated",
            has_tfa: overrides.hasTfa ?? false,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

    return {user, username, password};
};

const createSession = async (userId: number, tfaVerified: boolean) =>
    db
        .insertInto("authentication_tokens")
        .values({
            user_id: userId,
            expired_at: new Date(Date.now() + 60 * 60 * 1000),
            tfa_verified: tfaVerified,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

const issueToken = (
    user: {id: number},
    sessionId: number,
    tfa: boolean,
) =>
    tokenService.generateToken({
        uid: Number(user.id),
        tid: Number(sessionId),
        tfa,
        rol: "customer",
        bpa: 0,
    });

const login = (username: string, password: string) =>
    request(app).post("/api/v1/auth/login").send({username, password});

const readRefreshCookie = (response: {
    headers: Record<string, any>;
}) => {
    const cookies = response.headers["set-cookie"] ?? [];
    const list = Array.isArray(cookies) ? cookies : [cookies];

    return list.find((entry: string) =>
        entry.startsWith("refresh_token="),
    ) as string | undefined;
};

const setTfaPolicy = async (value: "disabled" | "global") => {
    const setting = await db
        .selectFrom("settings")
        .select("id")
        .where("slug", "=", "tta_policy")
        .executeTakeFirst();

    if (setting) {
        await settingService.updateSetting(setting.id, {value});
    }
};

const cleanup = async () => {
    await db.deleteFrom("outbox_events").execute();
    await db.deleteFrom("tfa_recovery_codes").execute();
    await db.deleteFrom("two_factor_authentications").execute();
    await db.deleteFrom("verification_tokens").execute();
    await db.deleteFrom("password_recoveries").execute();
    await db.deleteFrom("refresh_tokens").execute();
    await db.deleteFrom("authentication_tokens").execute();
    await db.deleteFrom("audit_logs").execute();
    await db.deleteFrom("rate_limits").execute();
    await db.deleteFrom("idempotency_keys").execute();
    await db.deleteFrom("users").execute();
    await db
        .deleteFrom("roles")
        .where("slug", "like", "security-test-%")
        .execute();
};

describe("Security audit regressions", () => {
    beforeEach(async () => {
        rateLimitControl.enabled = false;
        await cleanup();
        await setTfaPolicy("disabled");
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await setTfaPolicy("disabled");
        await cleanup();
    });

    describe("F-01: pending-TFA sessions are not full sessions", () => {
        it("blocks a password-only session from ordinary protected routes", async () => {
            const {user} = await createUser();
            const session = await createSession(Number(user.id), false);
            const token = issueToken(user, session.id, false);

            const sessions = await request(app)
                .get("/api/v1/auth/sessions")
                .set("Authorization", `Bearer ${token}`);

            expect(sessions.status).toBe(403);
            expect(sessions.body.code).toBe("AUTH_OTP_INCOMPLETE");

            /*
             * Enrollment is a security-state change, so a pending
             * session must not reach it either.
             */
            const enroll = await request(app)
                .post("/api/v1/auth/tfa/enroll/send")
                .set("Authorization", `Bearer ${token}`);

            expect(enroll.status).toBe(403);
            expect(enroll.body.code).toBe("AUTH_OTP_INCOMPLETE");
        });

        it("still allows a pending session to log out", async () => {
            const {user} = await createUser();
            const session = await createSession(Number(user.id), false);
            const token = issueToken(user, session.id, false);

            const response = await request(app)
                .post("/api/v1/auth/logout")
                .set("Authorization", `Bearer ${token}`);

            expect(response.status).toBe(204);
        });
    });

    describe("F-02: administrative password reset revokes credentials", () => {
        it("invalidates the access token and refresh token of the target", async () => {
            const admin = await createUser({roleSlug: "admin"});
            const target = await createUser();

            const targetLogin = await login(
                target.username,
                target.password,
            );
            expect(targetLogin.status).toBe(200);

            const refreshCookie = readRefreshCookie(targetLogin);
            expect(refreshCookie).toBeTruthy();

            const adminLogin = await login(admin.username, admin.password);
            expect(adminLogin.status).toBe(200);

            const update = await request(app)
                .put(`/api/v1/users/${target.user.id}`)
                .set(
                    "Authorization",
                    `Bearer ${adminLogin.body.access_token}`,
                )
                .send({
                    first_name: "Reset",
                    last_name: "ByAdmin",
                    username: target.username,
                    status: "Activated",
                    password: "NewPassword123!",
                });

            expect(update.status).toBe(200);

            const oldAccess = await request(app)
                .get("/api/v1/auth/sessions")
                .set(
                    "Authorization",
                    `Bearer ${targetLogin.body.access_token}`,
                );

            expect(oldAccess.status).toBe(401);

            const refresh = await request(app)
                .post("/api/v1/auth/refresh")
                .set("Cookie", refreshCookie!);

            expect(refresh.status).toBe(401);

            const stored = await db
                .selectFrom("refresh_tokens")
                .selectAll()
                .where("user_id", "=", Number(target.user.id))
                .execute();

            /*
             * Deleting the session cascades to its refresh tokens and
             * the explicit revocation covers any other family. Either
             * way nothing remains usable.
             */
            expect(
                stored.filter((row) => row.revoked_at === null),
            ).toHaveLength(0);
        });
    });

    describe("F-06: registration honours the global TFA policy", () => {
        it("creates a pending session without a refresh token", async () => {
            await setTfaPolicy("global");

            const username = randomUsername();
            const response = await request(app)
                .post("/api/v1/auth/register")
                .send({
                    first_name: "Global",
                    last_name: "Policy",
                    username,
                    email: `${username}@example.com`,
                    password: "Password123!",
                });

            expect(response.status).toBe(201);
            expect(response.body.tfa_required).toBe(true);
            expect(readRefreshCookie(response)).toBeUndefined();

            /*
             * The registration controller does not expose the user id,
             * so resolve the session through the signed token.
             */
            const payload = tokenService.verifyToken(
                response.body.access_token,
            );
            const session = await db
                .selectFrom("authentication_tokens")
                .selectAll()
                .where("id", "=", payload.tid)
                .executeTakeFirstOrThrow();

            expect(session.tfa_verified).toBe(false);

            const blocked = await request(app)
                .get("/api/v1/auth/sessions")
                .set(
                    "Authorization",
                    `Bearer ${response.body.access_token}`,
                );

            expect(blocked.status).toBe(403);
            expect(blocked.body.code).toBe("AUTH_OTP_INCOMPLETE");
        });
    });

    describe("F-07: TFA enrollment revokes pre-existing sessions", () => {
        it("keeps only the enrolling session and revokes its siblings", async () => {
            const {user} = await createUser();
            const enrolling = await createSession(Number(user.id), true);
            const other = await createSession(Number(user.id), true);

            await db
                .insertInto("refresh_tokens")
                .values({
                    session_id: Number(other.id),
                    user_id: Number(user.id),
                    token_hash: createHash("sha256")
                        .update(randomUUID())
                        .digest("hex"),
                    family_id: randomUUID(),
                    expires_at: new Date(Date.now() + 60_000),
                })
                .execute();

            const token = issueToken(user, enrolling.id, true);

            const sendMailSpy = vi
                .spyOn(sgMail, "send")
                .mockResolvedValue([] as any);

            const send = await request(app)
                .post("/api/v1/auth/tfa/enroll/send")
                .set("Authorization", `Bearer ${token}`);

            expect(send.status).toBe(200);

            const mail = sendMailSpy.mock.calls[0]?.[0] as {
                text?: string;
            };
            const code = mail?.text?.match(/\b(\d{6})\b/)?.[1];

            expect(code).toBeDefined();

            const enroll = await request(app)
                .post("/api/v1/auth/tfa/enroll")
                .set("Authorization", `Bearer ${token}`)
                .send({code});

            expect(enroll.status).toBe(200);

            const remaining = await db
                .selectFrom("authentication_tokens")
                .select("id")
                .where("user_id", "=", Number(user.id))
                .execute();

            expect(remaining.map((row) => Number(row.id))).toEqual([
                Number(enrolling.id),
            ]);

            const siblingToken = await db
                .selectFrom("refresh_tokens")
                .selectAll()
                .where("session_id", "=", Number(other.id))
                .executeTakeFirst();

            /*
             * The sibling session and its token are gone; the enrolling
             * session keeps working.
             */
            expect(siblingToken).toBeUndefined();
        });
    });

    describe("F-08: role security changes invalidate issued tokens", () => {
        it("bumps authorization versions and removes sessions and refresh tokens", async () => {
            const suffix = randomUUID().slice(0, 8);
            const role = await db
                .insertInto("roles")
                .values({
                    name: `Security test ${suffix}`,
                    slug: `security-test-${suffix}`,
                    is_public: false,
                })
                .returningAll()
                .executeTakeFirstOrThrow();

            const {user} = await createUser({roleId: Number(role.id)});
            const session = await createSession(Number(user.id), true);

            await db
                .insertInto("refresh_tokens")
                .values({
                    session_id: Number(session.id),
                    user_id: Number(user.id),
                    token_hash: createHash("sha256")
                        .update(randomUUID())
                        .digest("hex"),
                    family_id: randomUUID(),
                    expires_at: new Date(Date.now() + 60_000),
                })
                .execute();

            const repository = new RoleRepository(db);
            const updated = await repository.update(Number(role.id), {
                is_bypass_authorization: true,
            });

            expect(updated).not.toBeNull();

            const storedUser = await db
                .selectFrom("users")
                .select("authorization_version")
                .where("id", "=", Number(user.id))
                .executeTakeFirstOrThrow();

            expect(Number(storedUser.authorization_version)).toBe(1);

            const sessions = await db
                .selectFrom("authentication_tokens")
                .select("id")
                .where("user_id", "=", Number(user.id))
                .execute();

            expect(sessions).toHaveLength(0);

            const tokens = await db
                .selectFrom("refresh_tokens")
                .selectAll()
                .where("user_id", "=", Number(user.id))
                .execute();

            expect(
                tokens.filter((row) => row.revoked_at === null),
            ).toHaveLength(0);
        });
    });

    describe("F-09: verification codes are bound to the current target", () => {
        it("rejects a code issued for a different email address", async () => {
            const {user} = await createUser();
            const session = await createSession(Number(user.id), true);
            const token = issueToken(user, session.id, true);

            const rawToken = `target-binding-${randomUUID()}`;
            const otherTarget = `attacker-${randomUUID()}@example.com`;

            await db
                .insertInto("verification_tokens")
                .values({
                    user_id: Number(user.id),
                    channel: "email",
                    target: otherTarget,
                    token_hash: createHash("sha256")
                        .update(rawToken)
                        .digest("hex"),
                    expires_at: new Date(Date.now() + 60_000),
                })
                .execute();

            const response = await request(app)
                .post("/api/v1/account/email/verification/confirm")
                .set("Authorization", `Bearer ${token}`)
                .send({code: rawToken});

            expect(response.status).toBe(401);

            const stored = await db
                .selectFrom("users")
                .select("is_email_verified")
                .where("id", "=", Number(user.id))
                .executeTakeFirstOrThrow();

            expect(stored.is_email_verified).toBe(false);
        });
    });

    describe("F-10/F-11: recovery does not expose channel or account state", () => {
        it("rejects the unsupported phone channel without writing a row", async () => {
            const response = await request(app)
                .post("/api/v1/auth/password-recovery/send")
                .send({
                    type: "phone",
                    send_to: "+14155552671",
                });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe("INVALID_RECOVERY_TYPE");

            const rows = await db
                .selectFrom("password_recoveries")
                .selectAll()
                .execute();

            expect(rows).toHaveLength(0);
        });

        it("applies the same cooldown to an unknown target", async () => {
            const email = `unknown-${randomUUID()}@example.com`;

            const first = await request(app)
                .post("/api/v1/auth/password-recovery/send")
                .send({type: "email", send_to: email});

            expect(first.status).toBe(200);

            const second = await request(app)
                .post("/api/v1/auth/password-recovery/send")
                .send({type: "email", send_to: email});

            expect(second.status).toBe(429);

            const row = await db
                .selectFrom("password_recoveries")
                .selectAll()
                .where("send_to", "=", email)
                .executeTakeFirstOrThrow();

            expect(row.user_id).toBeNull();
        });
    });

    describe("F-15: Swagger UI assets are pinned and integrity-checked", () => {
        it("serves a CSP without unsafe-inline scripts and pinned SRI assets", async () => {
            const page = await request(app).get("/api-docs");

            expect(page.status).toBe(200);
            expect(page.text).toContain(
                "swagger-ui-dist@5.35.0/swagger-ui.css",
            );
            expect(page.text).toContain('integrity="sha384-');
            expect(page.text).toContain('crossorigin="anonymous"');
            expect(page.text).toContain('src="/swagger-ui-init.js"');

            const policy = page.headers["content-security-policy"];

            expect(policy).toContain("script-src 'self' https://unpkg.com;");
            expect(policy).not.toContain(
                "script-src 'self' 'unsafe-inline'",
            );

            const init = await request(app).get("/swagger-ui-init.js");

            expect(init.status).toBe(200);
            expect(init.headers["content-type"]).toContain(
                "application/javascript",
            );
            expect(init.text).toContain("SwaggerUIBundle");
        });
    });
});
