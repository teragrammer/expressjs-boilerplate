import {beforeEach, describe, expect, it, vi} from "vitest";
import {SessionService} from "./session.service";
import {AuthenticationTokenRepository} from "./authentication-token.repository";
import {RefreshTokenRepository} from "./refresh-token.repository";
import {TokenService} from "./authentication-token.service";
import {RoleService} from "../../system/roles/role.service";
import {UserRepository} from "../../users/user.repository";
import {DateUtil} from "../../../common/utils/date.util";
import Messages from "../../../common/utils/messages";

describe("SessionService", () => {
    let service: SessionService;

    let authenticationTokenRepository: {
        create: ReturnType<typeof vi.fn>;
        findById: ReturnType<typeof vi.fn>;
        deleteById: ReturnType<typeof vi.fn>;
        deleteAllByUserId: ReturnType<typeof vi.fn>;
    };

    let refreshTokenRepository: {
        create: ReturnType<typeof vi.fn>;
        findByHash: ReturnType<typeof vi.fn>;
        revoke: ReturnType<typeof vi.fn>;
        revokeFamily: ReturnType<typeof vi.fn>;
        revokeBySessionId: ReturnType<typeof vi.fn>;
        revokeAllByUserId: ReturnType<typeof vi.fn>;
    };

    let tokenService: {
        generateToken: ReturnType<typeof vi.fn>;
    };

    let roleService: {
        findById: ReturnType<typeof vi.fn>;
    };

    let userRepository: {
        findAuthById: ReturnType<typeof vi.fn>;
    };

    const user = {
        id: 7,
        status: "Activated",
        authorization_version: 3,
    };

    const role = {id: 1, slug: "customer", is_bypass_authorization: false};

    const expiry = new Date("2030-01-01T00:00:00.000Z");

    beforeEach(() => {
        authenticationTokenRepository = {
            create: vi.fn().mockResolvedValue({id: 42}),
            findById: vi.fn().mockResolvedValue({id: 42, user_id: 7}),
            deleteById: vi.fn().mockResolvedValue(true),
            deleteAllByUserId: vi.fn().mockResolvedValue(2),
        };

        refreshTokenRepository = {
            create: vi.fn().mockResolvedValue({id: "r1"}),
            findByHash: vi.fn(),
            revoke: vi.fn(),
            revokeFamily: vi.fn().mockResolvedValue(1),
            revokeBySessionId: vi.fn().mockResolvedValue(1),
            revokeAllByUserId: vi.fn().mockResolvedValue(3),
        };

        tokenService = {
            generateToken: vi.fn().mockReturnValue("signed.token"),
        };

        roleService = {
            findById: vi.fn().mockResolvedValue(role),
        };

        userRepository = {
            findAuthById: vi.fn().mockResolvedValue(user),
        };

        service = new SessionService(
            authenticationTokenRepository as unknown as AuthenticationTokenRepository,
            refreshTokenRepository as unknown as RefreshTokenRepository,
            tokenService as unknown as TokenService,
            roleService as unknown as RoleService,
            userRepository as unknown as UserRepository,
            {expiredAt: vi.fn().mockReturnValue(expiry)} as unknown as DateUtil,
        );
    });

    describe("issue()", () => {
        it("creates a session and returns a credential pair", async () => {
            const result = await service.issue(7, {tfa: true});

            expect(result.accessToken).toBe("signed.token");
            expect(result.sessionId).toBe(42);
            expect(result.expiresAt).toBe(expiry);
            expect(result.refreshToken).toBeTruthy();

            expect(authenticationTokenRepository.create).toHaveBeenCalledTimes(1);
            expect(refreshTokenRepository.create).toHaveBeenCalledTimes(1);
        });

        it("stores only the hash of the refresh token", async () => {
            const result = await service.issue(7, {tfa: true});

            const stored = refreshTokenRepository.create.mock.calls[0][0];

            expect(stored.token_hash).not.toBe(result.refreshToken);
            expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
        });

        it("embeds the role and the authorization version in the token", async () => {
            await service.issue(7, {tfa: true});

            expect(tokenService.generateToken).toHaveBeenCalledWith({
                uid: 7,
                tid: 42,
                tfa: true,
                rol: "customer",
                bpa: 0,
                av: 3,
            });
        });

        it("fails when the user does not exist", async () => {
            userRepository.findAuthById.mockResolvedValue(null);

            await expect(service.issue(7, {tfa: true})).rejects.toMatchObject({
                errorCode: Messages.DATA_NOT_FOUND.code,
            });
        });
    });

    describe("issueForSession()", () => {
        it("issues a token for an existing session", async () => {
            const result = await service.issueForSession(
                42,
                user,
                role,
                true,
            );

            expect(result.accessToken).toBe("signed.token");
            expect(result.refreshToken).toBe("");
            expect(refreshTokenRepository.create).not.toHaveBeenCalled();
        });

        it("issues a refresh token when asked to", async () => {
            const result = await service.issueForSession(
                42,
                user,
                role,
                true,
                {includeRefreshToken: true},
            );

            expect(result.refreshToken).toBeTruthy();
            expect(refreshTokenRepository.create).toHaveBeenCalledTimes(1);
        });
    });

    describe("rotate()", () => {
        it("revokes the presented token and issues a new one", async () => {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60_000),
                revoked_at: null,
                replaced_by: null,
            });

            const result = await service.rotate("presented-token");

            expect(result.accessToken).toBe("signed.token");
            expect(result.sessionId).toBe(42);
            expect(refreshTokenRepository.revoke).toHaveBeenCalledWith(
                "old",
                expect.any(String),
            );
        });

        it("revokes the whole family when a used token is presented", async () => {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60_000),
                revoked_at: new Date(),
                replaced_by: "next",
            });

            await expect(
                service.rotate("reused-token"),
            ).rejects.toMatchObject({
                errorCode: Messages.INVALID_TOKEN.code,
            });

            expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith(
                "family-1",
            );
        });

        it("rejects an unknown token", async () => {
            refreshTokenRepository.findByHash.mockResolvedValue(null);

            await expect(
                service.rotate("unknown"),
            ).rejects.toMatchObject({
                errorCode: Messages.INVALID_TOKEN.code,
            });
        });

        it("rejects an expired token", async () => {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() - 1000),
                revoked_at: null,
                replaced_by: null,
            });

            await expect(
                service.rotate("expired"),
            ).rejects.toMatchObject({
                errorCode: Messages.EXPIRED_TOKEN.code,
            });
        });

        it("rejects the rotation when the session is gone", async () => {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60_000),
                revoked_at: null,
                replaced_by: null,
            });

            authenticationTokenRepository.findById.mockResolvedValue(null);

            await expect(
                service.rotate("token"),
            ).rejects.toMatchObject({
                errorCode: Messages.SESSION_EXPIRED.code,
            });
        });

        it("revokes the family when the account is not active", async () => {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60_000),
                revoked_at: null,
                replaced_by: null,
            });

            userRepository.findAuthById.mockResolvedValue({
                ...user,
                status: "Suspended",
            });

            await expect(
                service.rotate("token"),
            ).rejects.toMatchObject({
                errorCode: Messages.SESSION_EXPIRED.code,
            });

            expect(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith(
                "family-1",
            );
        });
    });

    describe("revokeSession()", () => {
        it("revokes the refresh token and deletes the session", async () => {
            await service.revokeSession(42);

            expect(refreshTokenRepository.revokeBySessionId).toHaveBeenCalledWith(
                42,
            );
            expect(authenticationTokenRepository.deleteById).toHaveBeenCalledWith(
                42,
            );
        });
    });

    describe("revokeAllSessions()", () => {
        it("revokes every session of the user", async () => {
            const revoked = await service.revokeAllSessions(7);

            expect(revoked).toBe(2);
            expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith(
                7,
            );
            expect(
                authenticationTokenRepository.deleteAllByUserId,
            ).toHaveBeenCalledWith(7);
        });
    });
});
