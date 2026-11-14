import {beforeEach, describe, expect, it, vi} from "vitest";
import {Request, Response} from "express";
import {AuthenticationMiddleware} from "./authentication.middleware";
import {AppError} from "../utils/errors";
import Messages from "../utils/messages";

const {mockVerifyToken, mockFindUser, mockFindAuthToken} = vi.hoisted(() => ({
    mockVerifyToken: vi.fn(),
    mockFindUser: vi.fn(),
    mockFindAuthToken: vi.fn(),
}));

vi.mock("../../../src/config/container", () => ({
    tokenService: {verifyToken: mockVerifyToken},
    userService: {findById: mockFindUser, findAuthById: mockFindUser},
    authService: {findAuthenticationToken: mockFindAuthToken},
}));

describe("AuthenticationMiddleware Unit Tests", () => {
    let mockReq: Partial<Request> & { credentials?: any };
    let mockRes: Partial<Response>;
    let nextMock: any;

    beforeEach(() => {
        vi.resetAllMocks();
        nextMock = vi.fn();
        mockRes = {};
        mockReq = {headers: {}};
    });

    describe("Halt Mode Enabled (isHalt = true)", () => {
        it("should call next() with a 401 AppError if authorization header is completely missing", async () => {
            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(
                new AppError(Messages.UNAUTHORIZED, "Authorization token missing or malformed")
            );
        });

        it("should call next() with a 401 AppError if authorization header is empty string", async () => {
            mockReq.headers!.authorization = "";
            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(
                new AppError(Messages.UNAUTHORIZED, "Authorization token missing or malformed")
            );
        });

        it("should call next() with a 401 AppError if authorization header does not use Bearer scheme", async () => {
            mockReq.headers!.authorization = "Basic dXNlcjpwYXNz";
            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(
                new AppError(Messages.UNAUTHORIZED, "Authorization token missing or malformed")
            );
        });

        it("should call next() with a 401 AppError if authorization header is malformed without spacing", async () => {
            mockReq.headers!.authorization = "Bearerabc123";
            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(
                new AppError(Messages.UNAUTHORIZED, "Authorization token missing or malformed")
            );
        });

        it("should call next() with a 401 AppError if token verification throws an error", async () => {
            mockReq.headers!.authorization = "Bearer invalid-token";
            mockVerifyToken.mockImplementation(() => {
                throw new Error("JWT Expired");
            });

            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(
                new AppError(Messages.UNAUTHORIZED, "Invalid or expired authentication token")
            );
        });

        it("should bind lazy promises to req.credentials on a valid token structure", async () => {
            const mockPayload = {uid: 42, tid: 99, tfa: true};
            mockReq.headers!.authorization = "Bearer valid-token";
            mockVerifyToken.mockReturnValue(mockPayload);
            mockFindUser.mockResolvedValue({id: 42, name: "John Doe"});
            mockFindAuthToken.mockResolvedValue({
                id: 99,
                active: true,
                tfa_verified: true,
            });

            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith();
            expect(mockReq.credentials.jwt).toEqual(mockPayload);

            const userResult = await mockReq.credentials.user();
            const authResult = await mockReq.credentials.authentication();

            expect(mockFindUser).toHaveBeenCalledWith(42);
            expect(mockFindAuthToken).toHaveBeenCalledWith(mockPayload);
            expect(userResult.name).toBe("John Doe");
            expect(authResult.active).toBe(true);
        });

        it("should reject a pending-TFA session by default", async () => {
            mockReq.headers!.authorization = "Bearer pending-token";
            mockVerifyToken.mockReturnValue({
                uid: 42,
                tid: 99,
                tfa: false,
            });
            mockFindAuthToken.mockResolvedValue({
                id: 99,
                active: true,
                tfa_verified: false,
            });

            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorCode: "AUTH_OTP_INCOMPLETE",
                }),
            );
        });

        it("should reject a session whose token claims TFA completion but whose durable state does not", async () => {
            mockReq.headers!.authorization = "Bearer stale-token";
            mockVerifyToken.mockReturnValue({
                uid: 42,
                tid: 99,
                tfa: true,
            });
            mockFindAuthToken.mockResolvedValue({
                id: 99,
                active: true,
                tfa_verified: false,
            });

            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    errorCode: "AUTH_OTP_INCOMPLETE",
                }),
            );
        });

        it("should allow a pending-TFA session when the route opts in", async () => {
            mockReq.headers!.authorization = "Bearer pending-token";
            mockVerifyToken.mockReturnValue({
                uid: 42,
                tid: 99,
                tfa: false,
            });
            mockFindAuthToken.mockResolvedValue({
                id: 99,
                active: true,
                tfa_verified: false,
            });

            const middleware = AuthenticationMiddleware(true, {
                allowPendingTfa: true,
            });
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith();
        });
    });

    describe("Halt Mode Disabled (isHalt = false)", () => {
        it("should call next() cleanly without credentials if header is missing", async () => {
            const middleware = AuthenticationMiddleware(false);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith();
            expect(mockReq.credentials).toBeUndefined();
        });

        it("should call next() cleanly without credentials if header is malformed", async () => {
            mockReq.headers!.authorization = "NotBearer xyz123";
            const middleware = AuthenticationMiddleware(false);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith();
            expect(mockReq.credentials).toBeUndefined();
        });

        it("should call next() cleanly without credentials if token fails verification", async () => {
            mockReq.headers!.authorization = "Bearer expired-token";
            mockVerifyToken.mockImplementation(() => {
                throw new Error("Signature validation failed");
            });

            const middleware = AuthenticationMiddleware(false);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith();
            expect(mockReq.credentials).toBeUndefined();
        });
    });

    describe("Global Error Handling Block", () => {
        it("should catch unexpected structural system errors and pass them downstream via next()", async () => {
            // Force a runtime crash before the verification try/catch by corrupting headers access
            Object.defineProperty(mockReq, "headers", {
                get: () => {
                    throw new Error("Hardware/Memory Fault");
                }
            });

            const middleware = AuthenticationMiddleware(true);
            await middleware(mockReq as Request, mockRes as Response, nextMock);

            expect(nextMock).toHaveBeenCalledWith(expect.any(Error));
            expect(nextMock.mock.calls[0][0].message).toBe("Hardware/Memory Fault");
        });
    });
});