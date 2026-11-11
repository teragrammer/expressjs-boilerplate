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
const authentication_middleware_1 = require("./authentication.middleware");
const errors_1 = require("../utils/errors");
const messages_1 = __importDefault(require("../utils/messages"));
const { mockVerifyToken, mockFindUser, mockFindAuthToken } = vitest_1.vi.hoisted(() => ({
    mockVerifyToken: vitest_1.vi.fn(),
    mockFindUser: vitest_1.vi.fn(),
    mockFindAuthToken: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../../src/config/container", () => ({
    tokenService: { verifyToken: mockVerifyToken },
    userService: { findById: mockFindUser, findAuthById: mockFindUser },
    authService: { findAuthenticationToken: mockFindAuthToken },
}));
(0, vitest_1.describe)("AuthenticationMiddleware Unit Tests", () => {
    let mockReq;
    let mockRes;
    let nextMock;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetAllMocks();
        nextMock = vitest_1.vi.fn();
        mockRes = {};
        mockReq = { headers: {} };
    });
    (0, vitest_1.describe)("Halt Mode Enabled (isHalt = true)", () => {
        (0, vitest_1.it)("should call next() with a 401 AppError if authorization header is completely missing", () => __awaiter(void 0, void 0, void 0, function* () {
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(true);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Authorization token missing or malformed"));
        }));
        (0, vitest_1.it)("should call next() with a 401 AppError if authorization header is empty string", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers.authorization = "";
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(true);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Authorization token missing or malformed"));
        }));
        (0, vitest_1.it)("should call next() with a 401 AppError if authorization header does not use Bearer scheme", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers.authorization = "Basic dXNlcjpwYXNz";
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(true);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Authorization token missing or malformed"));
        }));
        (0, vitest_1.it)("should call next() with a 401 AppError if authorization header is malformed without spacing", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers.authorization = "Bearerabc123";
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(true);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Authorization token missing or malformed"));
        }));
        (0, vitest_1.it)("should call next() with a 401 AppError if token verification throws an error", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers.authorization = "Bearer invalid-token";
            mockVerifyToken.mockImplementation(() => {
                throw new Error("JWT Expired");
            });
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(true);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Invalid or expired authentication token"));
        }));
        (0, vitest_1.it)("should bind lazy promises to req.credentials on a valid token structure", () => __awaiter(void 0, void 0, void 0, function* () {
            const mockPayload = { uid: 42, tid: 99 };
            mockReq.headers.authorization = "Bearer valid-token";
            mockVerifyToken.mockReturnValue(mockPayload);
            mockFindUser.mockResolvedValue({ id: 42, name: "John Doe" });
            mockFindAuthToken.mockResolvedValue({ id: 99, active: true });
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(true);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith();
            (0, vitest_1.expect)(mockReq.credentials.jwt).toEqual(mockPayload);
            const userResult = yield mockReq.credentials.user();
            const authResult = yield mockReq.credentials.authentication();
            (0, vitest_1.expect)(mockFindUser).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(mockFindAuthToken).toHaveBeenCalledWith(mockPayload);
            (0, vitest_1.expect)(userResult.name).toBe("John Doe");
            (0, vitest_1.expect)(authResult.active).toBe(true);
        }));
    });
    (0, vitest_1.describe)("Halt Mode Disabled (isHalt = false)", () => {
        (0, vitest_1.it)("should call next() cleanly without credentials if header is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(false);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith();
            (0, vitest_1.expect)(mockReq.credentials).toBeUndefined();
        }));
        (0, vitest_1.it)("should call next() cleanly without credentials if header is malformed", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers.authorization = "NotBearer xyz123";
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(false);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith();
            (0, vitest_1.expect)(mockReq.credentials).toBeUndefined();
        }));
        (0, vitest_1.it)("should call next() cleanly without credentials if token fails verification", () => __awaiter(void 0, void 0, void 0, function* () {
            mockReq.headers.authorization = "Bearer expired-token";
            mockVerifyToken.mockImplementation(() => {
                throw new Error("Signature validation failed");
            });
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(false);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith();
            (0, vitest_1.expect)(mockReq.credentials).toBeUndefined();
        }));
    });
    (0, vitest_1.describe)("Global Error Handling Block", () => {
        (0, vitest_1.it)("should catch unexpected structural system errors and pass them downstream via next()", () => __awaiter(void 0, void 0, void 0, function* () {
            // Force a runtime crash before the verification try/catch by corrupting headers access
            Object.defineProperty(mockReq, "headers", {
                get: () => {
                    throw new Error("Hardware/Memory Fault");
                }
            });
            const middleware = (0, authentication_middleware_1.AuthenticationMiddleware)(true);
            yield middleware(mockReq, mockRes, nextMock);
            (0, vitest_1.expect)(nextMock).toHaveBeenCalledWith(vitest_1.expect.any(Error));
            (0, vitest_1.expect)(nextMock.mock.calls[0][0].message).toBe("Hardware/Memory Fault");
        }));
    });
});
