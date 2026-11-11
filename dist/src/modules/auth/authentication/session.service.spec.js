"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const session_service_1 = require("./session.service");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
(0, vitest_1.describe)("SessionService", () => {
    let service;
    let authenticationTokenRepository;
    let refreshTokenRepository;
    let tokenService;
    let roleService;
    let userRepository;
    const user = {
        id: 7,
        status: "Activated",
        authorization_version: 3,
    };
    const role = { id: 1, slug: "customer", is_bypass_authorization: false };
    const expiry = new Date("2030-01-01T00:00:00.000Z");
    (0, vitest_1.beforeEach)(() => {
        authenticationTokenRepository = {
            create: vitest_1.vi.fn().mockResolvedValue({ id: 42 }),
            findById: vitest_1.vi.fn().mockResolvedValue({ id: 42, user_id: 7 }),
            deleteById: vitest_1.vi.fn().mockResolvedValue(true),
            deleteAllByUserId: vitest_1.vi.fn().mockResolvedValue(2),
        };
        refreshTokenRepository = {
            create: vitest_1.vi.fn().mockResolvedValue({ id: "r1" }),
            findByHash: vitest_1.vi.fn(),
            revoke: vitest_1.vi.fn(),
            revokeFamily: vitest_1.vi.fn().mockResolvedValue(1),
            revokeBySessionId: vitest_1.vi.fn().mockResolvedValue(1),
            revokeAllByUserId: vitest_1.vi.fn().mockResolvedValue(3),
        };
        tokenService = {
            generateToken: vitest_1.vi.fn().mockReturnValue("signed.token"),
        };
        roleService = {
            findById: vitest_1.vi.fn().mockResolvedValue(role),
        };
        userRepository = {
            findAuthById: vitest_1.vi.fn().mockResolvedValue(user),
        };
        service = new session_service_1.SessionService(authenticationTokenRepository, refreshTokenRepository, tokenService, roleService, userRepository, { expiredAt: vitest_1.vi.fn().mockReturnValue(expiry) });
    });
    (0, vitest_1.describe)("issue()", () => {
        (0, vitest_1.it)("creates a session and returns a credential pair", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield service.issue(7, { tfa: true });
            (0, vitest_1.expect)(result.accessToken).toBe("signed.token");
            (0, vitest_1.expect)(result.sessionId).toBe(42);
            (0, vitest_1.expect)(result.expiresAt).toBe(expiry);
            (0, vitest_1.expect)(result.refreshToken).toBeTruthy();
            (0, vitest_1.expect)(authenticationTokenRepository.create).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(refreshTokenRepository.create).toHaveBeenCalledTimes(1);
        }));
        (0, vitest_1.it)("stores only the hash of the refresh token", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield service.issue(7, { tfa: true });
            const stored = refreshTokenRepository.create.mock.calls[0][0];
            (0, vitest_1.expect)(stored.token_hash).not.toBe(result.refreshToken);
            (0, vitest_1.expect)(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
        }));
        (0, vitest_1.it)("embeds the role and the authorization version in the token", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.issue(7, { tfa: true });
            (0, vitest_1.expect)(tokenService.generateToken).toHaveBeenCalledWith({
                uid: 7,
                tid: 42,
                tfa: true,
                rol: "customer",
                bpa: 0,
                av: 3,
            });
        }));
        (0, vitest_1.it)("fails when the user does not exist", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.findAuthById.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.issue(7, { tfa: true })).rejects.toMatchObject({
                errorCode: messages_1.default.DATA_NOT_FOUND.code,
            });
        }));
    });
    (0, vitest_1.describe)("issueForSession()", () => {
        (0, vitest_1.it)("issues a token for an existing session", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield service.issueForSession(42, user, role, true);
            (0, vitest_1.expect)(result.accessToken).toBe("signed.token");
            (0, vitest_1.expect)(result.refreshToken).toBe("");
            (0, vitest_1.expect)(refreshTokenRepository.create).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("issues a refresh token when asked to", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = yield service.issueForSession(42, user, role, true, { includeRefreshToken: true });
            (0, vitest_1.expect)(result.refreshToken).toBeTruthy();
            (0, vitest_1.expect)(refreshTokenRepository.create).toHaveBeenCalledTimes(1);
        }));
    });
    (0, vitest_1.describe)("rotate()", () => {
        (0, vitest_1.it)("revokes the presented token and issues a new one", () => __awaiter(void 0, void 0, void 0, function* () {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60000),
                revoked_at: null,
                replaced_by: null,
            });
            const result = yield service.rotate("presented-token");
            (0, vitest_1.expect)(result.accessToken).toBe("signed.token");
            (0, vitest_1.expect)(result.sessionId).toBe(42);
            (0, vitest_1.expect)(refreshTokenRepository.revoke).toHaveBeenCalledWith("old", vitest_1.expect.any(String));
        }));
        (0, vitest_1.it)("revokes the whole family when a used token is presented", () => __awaiter(void 0, void 0, void 0, function* () {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60000),
                revoked_at: new Date(),
                replaced_by: "next",
            });
            yield (0, vitest_1.expect)(service.rotate("reused-token")).rejects.toMatchObject({
                errorCode: messages_1.default.INVALID_TOKEN.code,
            });
            (0, vitest_1.expect)(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith("family-1");
        }));
        (0, vitest_1.it)("rejects an unknown token", () => __awaiter(void 0, void 0, void 0, function* () {
            refreshTokenRepository.findByHash.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.rotate("unknown")).rejects.toMatchObject({
                errorCode: messages_1.default.INVALID_TOKEN.code,
            });
        }));
        (0, vitest_1.it)("rejects an expired token", () => __awaiter(void 0, void 0, void 0, function* () {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() - 1000),
                revoked_at: null,
                replaced_by: null,
            });
            yield (0, vitest_1.expect)(service.rotate("expired")).rejects.toMatchObject({
                errorCode: messages_1.default.EXPIRED_TOKEN.code,
            });
        }));
        (0, vitest_1.it)("rejects the rotation when the session is gone", () => __awaiter(void 0, void 0, void 0, function* () {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60000),
                revoked_at: null,
                replaced_by: null,
            });
            authenticationTokenRepository.findById.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.rotate("token")).rejects.toMatchObject({
                errorCode: messages_1.default.SESSION_EXPIRED.code,
            });
        }));
        (0, vitest_1.it)("revokes the family when the account is not active", () => __awaiter(void 0, void 0, void 0, function* () {
            refreshTokenRepository.findByHash.mockResolvedValue({
                id: "old",
                session_id: 42,
                user_id: 7,
                family_id: "family-1",
                expires_at: new Date(Date.now() + 60000),
                revoked_at: null,
                replaced_by: null,
            });
            userRepository.findAuthById.mockResolvedValue(Object.assign(Object.assign({}, user), { status: "Suspended" }));
            yield (0, vitest_1.expect)(service.rotate("token")).rejects.toMatchObject({
                errorCode: messages_1.default.SESSION_EXPIRED.code,
            });
            (0, vitest_1.expect)(refreshTokenRepository.revokeFamily).toHaveBeenCalledWith("family-1");
        }));
    });
    (0, vitest_1.describe)("revokeSession()", () => {
        (0, vitest_1.it)("revokes the refresh token and deletes the session", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.revokeSession(42);
            (0, vitest_1.expect)(refreshTokenRepository.revokeBySessionId).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(authenticationTokenRepository.deleteById).toHaveBeenCalledWith(42);
        }));
    });
    (0, vitest_1.describe)("revokeAllSessions()", () => {
        (0, vitest_1.it)("revokes every session of the user", () => __awaiter(void 0, void 0, void 0, function* () {
            const revoked = yield service.revokeAllSessions(7);
            (0, vitest_1.expect)(revoked).toBe(2);
            (0, vitest_1.expect)(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith(7);
            (0, vitest_1.expect)(authenticationTokenRepository.deleteAllByUserId).toHaveBeenCalledWith(7);
        }));
    });
});
