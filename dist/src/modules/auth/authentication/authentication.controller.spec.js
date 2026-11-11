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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const authentication_controller_1 = require("./authentication.controller");
const { mockLogin, mockLogout, sessionService, refreshTokenRepository, auditService } = vitest_1.vi.hoisted(() => ({
    mockLogin: vitest_1.vi.fn(),
    mockLogout: vitest_1.vi.fn(),
    sessionService: {
        rotate: vitest_1.vi.fn(),
        revokeAllSessions: vitest_1.vi.fn(),
    },
    refreshTokenRepository: {
        findActiveByUserId: vitest_1.vi.fn(),
    },
    auditService: {
        success: vitest_1.vi.fn(),
        failure: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
}));
(0, vitest_1.describe)("AuthenticationController", () => {
    let controller;
    let req;
    let res;
    let next;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        const authService = {
            login: mockLogin,
            logout: mockLogout,
        };
        controller = new authentication_controller_1.AuthenticationController(authService, sessionService, refreshTokenRepository, auditService);
        res = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn().mockReturnThis(),
            send: vitest_1.vi.fn().mockReturnThis(),
            sendStatus: vitest_1.vi.fn().mockReturnThis(),
            cookie: vitest_1.vi.fn().mockReturnThis(),
            clearCookie: vitest_1.vi.fn().mockReturnThis(),
        };
        next = vitest_1.vi.fn();
        req = {
            sanitize: {
                body: {
                    get: vitest_1.vi.fn(),
                    only: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                },
                query: {
                    get: vitest_1.vi.fn(),
                    only: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                },
                data: {
                    username: "testuser",
                    password: "password123",
                },
            },
            credentials: {
                jwt: {
                    tid: 45,
                    uid: 1,
                    tfa: false,
                },
                user: vitest_1.vi.fn(),
                authentication: vitest_1.vi.fn(),
            },
        };
    });
    (0, vitest_1.describe)("login()", () => {
        (0, vitest_1.it)("should log in using validated request data", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                username: "testuser",
                password: "password123",
            };
            const mockResult = {
                accessToken: "eyMockJwtToken",
                refreshToken: "mock-refresh-token",
                sessionId: 77,
                expiresAt: new Date("2030-01-01T00:00:00.000Z"),
                tfaRequired: false,
            };
            req.sanitize.data = validatedData;
            mockLogin.mockResolvedValue(mockResult);
            yield controller.login(req, res, next);
            (0, vitest_1.expect)(mockLogin).toHaveBeenCalledWith(validatedData, vitest_1.expect.any(Object));
            (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
            (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({
                token: "eyMockJwtToken",
                access_token: "eyMockJwtToken",
                expires_at: mockResult.expiresAt,
                tfa_required: false,
                tfaRequired: false,
            });
            // The refresh token is delivered as an HttpOnly cookie.
            (0, vitest_1.expect)(res.cookie).toHaveBeenCalledWith("refresh_token", "mock-refresh-token", vitest_1.expect.objectContaining({ httpOnly: true }));
            (0, vitest_1.expect)(next).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward business layer login failures", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                username: "nonexistent",
                password: "wrongpassword",
            };
            const authError = new Error("Invalid credentials payload.");
            req.sanitize.data = validatedData;
            mockLogin.mockRejectedValue(authError);
            yield controller.login(req, res, next);
            (0, vitest_1.expect)(mockLogin).toHaveBeenCalledWith(validatedData, vitest_1.expect.any(Object));
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(authError);
            (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("logout()", () => {
        (0, vitest_1.it)("should invalidate an active JWT token session", () => __awaiter(void 0, void 0, void 0, function* () {
            mockLogout.mockResolvedValue(undefined);
            yield controller.logout(req, res, next);
            (0, vitest_1.expect)(mockLogout).toHaveBeenCalledWith(45);
            (0, vitest_1.expect)(res.sendStatus).toHaveBeenCalledWith(204);
            (0, vitest_1.expect)(next).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should pass logout errors to the error boundary", () => __awaiter(void 0, void 0, void 0, function* () {
            const logoutError = new Error("Database transaction aborted during token termination.");
            mockLogout.mockRejectedValue(logoutError);
            yield controller.logout(req, res, next);
            (0, vitest_1.expect)(mockLogout).toHaveBeenCalledWith(45);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(logoutError);
            (0, vitest_1.expect)(res.sendStatus).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward errors when credentials context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.credentials = undefined;
            yield controller.logout(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                message: "The provided authentication token is invalid or missing",
                errorCode: "INVALID_AUTH_TOKEN",
                statusCode: 401,
            }));
            (0, vitest_1.expect)(res.sendStatus).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockLogout).not.toHaveBeenCalled();
        }));
    });
});
