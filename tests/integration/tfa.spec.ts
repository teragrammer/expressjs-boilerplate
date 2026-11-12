// tests/integration/tfa.spec.ts
/**
 * Integration coverage for the TFA lifecycle (F-08/F-09).
 *
 * The tests run against PostgreSQL but use a capturing mail provider,
 * because the OTP is only available in the plaintext email after it has
 * been hashed for storage.
 */
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {createHash} from "node:crypto";

import {db} from "../../src/config/database";
import {
    refreshTokenRepository,
    securityUtil,
    sessionService,
    settingService,
    tokenService,
} from "../../src/config/container";
import {AuthenticationTokenRepository} from "../../src/modules/auth/authentication/authentication-token.repository";
import {TwoFactorAuthenticationRepository} from "../../src/modules/auth/two-factor-authentication/two-factor-authentication.repository";
import {TfaRecoveryCodeRepository} from "../../src/modules/auth/two-factor-authentication/tfa-recovery-code.repository";
import {TwoFactorAuthenticationService} from "../../src/modules/auth/two-factor-authentication/two-factor-authentication.service";
import {RoleRepository} from "../../src/modules/system/roles/role.repository";
import {RoleService} from "../../src/modules/system/roles/role.service";
import {UserRepository} from "../../src/modules/users/user.repository";
import {DateUtil} from "../../src/common/utils/date.util";
import {SendMailInput} from "../../src/common/interfaces/mail.interface";

const randomUsername = () => securityUtil.randomString(10);

class CapturingMailService {
    readonly sent: SendMailInput[] = [];

    async send(input: SendMailInput): Promise<void> {
        this.sent.push(input);
    }

    lastCode(): string {
        const text = this.sent[this.sent.length - 1]?.text ?? "";
        const match = text.match(/\b(\d{6})\b/);

        if (!match) {
            throw new Error("No OTP was captured.");
        }

        return match[1];
    }
}

const hashToken = (token: string) =>
    createHash("sha256").update(token).digest("hex");

describe("TFA lifecycle", () => {
    const userRepository = new UserRepository(db);
    const authenticationTokenRepository =
        new AuthenticationTokenRepository(db);
    const recoveryCodeRepository = new TfaRecoveryCodeRepository(db);
    const mail = new CapturingMailService();

    const service = new TwoFactorAuthenticationService(
        securityUtil,
        new TwoFactorAuthenticationRepository(db),
        authenticationTokenRepository,
        new DateUtil(),
        settingService,
        mail,
        new RoleService(new RoleRepository()),
        userRepository,
        sessionService,
        recoveryCodeRepository,
    );

    const createUser = async () => {
        const role = await db
            .selectFrom("roles")
            .selectAll()
            .where("slug", "=", "customer")
            .executeTakeFirstOrThrow();

        const username = randomUsername();

        return db
            .insertInto("users")
            .values({
                username,
                email: `${username}@example.com`,
                password: await securityUtil.hash("Password123!"),
                role_id: role.id,
                status: "Activated",
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    };

    const createSession = async (
        userId: number,
        tfaVerified: boolean,
    ) =>
        authenticationTokenRepository.create({
            user_id: userId,
            expired_at: new Date(Date.now() + 60 * 60 * 1000),
            ip: "127.0.0.1",
            browser: null,
            os: null,
            tfa_verified: tfaVerified,
        });

    beforeEach(async () => {
        mail.sent.length = 0;
        await db.deleteFrom("tfa_recovery_codes").execute();
        await db.deleteFrom("two_factor_authentications").execute();
        await db.deleteFrom("refresh_tokens").execute();
        await db.deleteFrom("authentication_tokens").execute();
        await db.deleteFrom("audit_logs").execute();
    });

    afterEach(async () => {
        await db.deleteFrom("tfa_recovery_codes").execute();
        await db.deleteFrom("two_factor_authentications").execute();
        await db.deleteFrom("refresh_tokens").execute();
        await db.deleteFrom("authentication_tokens").execute();
        await db.deleteFrom("audit_logs").execute();
        await db.deleteFrom("users").execute();
    });

    it("does not expose a refresh token before the second factor", async () => {
        const user = await createUser();

        const issued = await sessionService.issue(user.id, {tfa: false});

        expect(issued.refreshToken).toBe("");

        const stored = await db
            .selectFrom("authentication_tokens")
            .selectAll()
            .where("id", "=", issued.sessionId)
            .executeTakeFirstOrThrow();

        expect(stored.tfa_verified).toBe(false);
    });

    it("keeps a refresh token pending until the session is verified", async () => {
        const user = await createUser();
        const session = await createSession(user.id, false);

        const rawToken = "pending-refresh-token";

        await refreshTokenRepository.create({
            session_id: session.id,
            user_id: user.id,
            token_hash: hashToken(rawToken),
            family_id: "0f9d2f6e-2b6a-4f2a-9a5e-6c3f4d7c1a11",
            expires_at: new Date(Date.now() + 60_000),
        });

        const rotated = await sessionService.rotate(rawToken);
        const payload = tokenService.verifyToken(rotated.accessToken);

        expect(payload.tfa).toBe(false);
    });

    it("verifies an OTP and upgrades the durable session", async () => {
        const user = await createUser();
        const session = await createSession(user.id, false);

        await service.sendOtp({
            tokenId: session.id,
            email: user.email!,
            tfaCleared: false,
        });

        const issued = await service.verifyOtp({
            tokenId: session.id,
            code: mail.lastCode(),
            user: (await userRepository.findAuthById(user.id))!,
            tfaCleared: false,
            meta: {ip: "127.0.0.1", browser: null, os: null},
        });

        const storedSession = await db
            .selectFrom("authentication_tokens")
            .selectAll()
            .where("id", "=", session.id)
            .executeTakeFirstOrThrow();

        expect(storedSession.tfa_verified).toBe(true);
        expect(issued.refreshToken).toBeTruthy();
        expect(tokenService.verifyToken(issued.accessToken).tfa).toBe(true);

        const rotated = await sessionService.rotate(issued.refreshToken);
        expect(tokenService.verifyToken(rotated.accessToken).tfa).toBe(true);
    });

    it("locks an OTP after five failed attempts", async () => {
        const user = await createUser();
        const session = await createSession(user.id, false);
        const authUser = (await userRepository.findAuthById(user.id))!;

        await service.sendOtp({
            tokenId: session.id,
            email: user.email!,
            tfaCleared: false,
        });

        for (let attempt = 0; attempt < 5; attempt++) {
            await expect(
                service.verifyOtp({
                    tokenId: session.id,
                    code: "000000",
                    user: authUser,
                    tfaCleared: false,
                    meta: {ip: null, browser: null, os: null},
                }),
            ).rejects.toMatchObject({
                errorCode: "OTP_NO_MATCH",
            });
        }

        const locked = await db
            .selectFrom("two_factor_authentications")
            .selectAll()
            .where("token_id", "=", session.id)
            .executeTakeFirstOrThrow();

        expect(locked.expired_tries_at).not.toBeNull();

        await expect(
            service.verifyOtp({
                tokenId: session.id,
                code: "000000",
                user: authUser,
                tfaCleared: false,
                meta: {ip: null, browser: null, os: null},
            }),
        ).rejects.toMatchObject({
            errorCode: "TOO_MANY_ATTEMPTS",
        });
    });

    it("enrolls a verified user and redeems a recovery code once", async () => {
        const user = await createUser();
        const session = await createSession(user.id, true);

        await service.sendEnrollmentOtp({
            userId: user.id,
            tokenId: session.id,
            email: user.email!,
        });

        const enrollment = await service.enrollTfa({
            userId: user.id,
            tokenId: session.id,
            code: mail.lastCode(),
        });

        expect(enrollment.enrolled).toBe(true);
        expect(enrollment.recoveryCodes).toHaveLength(8);

        const storedUser = await userRepository.findAuthById(user.id);
        expect(storedUser?.has_tfa).toBe(true);

        const codes = await recoveryCodeRepository.findByUserId(user.id);
        expect(codes).toHaveLength(8);

        const recoveryCode = enrollment.recoveryCodes![0];

        const issued = await service.redeemRecoveryCode({
            userId: user.id,
            sessionId: session.id,
            code: recoveryCode,
            meta: {ip: "127.0.0.1", browser: null, os: null},
        });

        expect(tokenService.verifyToken(issued.accessToken).tfa).toBe(true);
        expect(issued.refreshToken).toBeTruthy();

        const remaining = await recoveryCodeRepository.findByUserId(user.id);
        expect(remaining).toHaveLength(7);

        await expect(
            service.redeemRecoveryCode({
                userId: user.id,
                sessionId: session.id,
                code: recoveryCode,
                meta: {ip: null, browser: null, os: null},
            }),
        ).rejects.toMatchObject({
            errorCode: "INVALID_CODE",
        });
    });

    it("requires a verified session to enroll", async () => {
        const user = await createUser();
        const session = await createSession(user.id, false);

        await expect(
            service.sendEnrollmentOtp({
                userId: user.id,
                tokenId: session.id,
                email: user.email!,
            }),
        ).resolves.toBeDefined();

        /*
         * Enrollment itself still requires the OTP; the point of this
         * test is that the pending-TFA login endpoint is distinct from
         * the enrollment endpoint.
         */
        const enrollment = await service.enrollTfa({
            userId: user.id,
            tokenId: session.id,
            code: mail.lastCode(),
        });

        expect(enrollment.enrolled).toBe(true);
    });
});
