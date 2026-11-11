import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {AuthenticationController} from "./authentication.controller";
import {AuthenticationService} from "./authentication.service";
import {SessionService} from "./session.service";
import {RefreshTokenRepository} from "./refresh-token.repository";
import {AuditService} from "../../audit/audit.service";

const {mockLogin, mockLogout, sessionService, refreshTokenRepository, auditService} =
    vi.hoisted(() => ({
        mockLogin: vi.fn(),
        mockLogout: vi.fn(),
        sessionService: {
            rotate: vi.fn(),
            revokeAllSessions: vi.fn(),
        },
        refreshTokenRepository: {
            findActiveByUserId: vi.fn(),
        },
        auditService: {
            success: vi.fn(),
            failure: vi.fn(),
        },
    }));

vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn: any) => (req: any, res: any, next: any) =>
        Promise.resolve(fn(req, res, next)).catch(next),
}));

describe("AuthenticationController", () => {
    let controller: AuthenticationController;

    let req: Partial<Request> & {
        sanitize?: any;
        credentials?: any;
    };

    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();

        const authService = {
            login: mockLogin,
            logout: mockLogout,
        } as unknown as AuthenticationService;

        controller = new AuthenticationController(
            authService,
            sessionService as unknown as SessionService,
            refreshTokenRepository as unknown as RefreshTokenRepository,
            auditService as unknown as AuditService,
        );

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
            sendStatus: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
        };

        next = vi.fn();

        req = {
            sanitize: {
                body: {
                    get: vi.fn(),
                    only: vi.fn(),
                    numeric: vi.fn(),
                },
                query: {
                    get: vi.fn(),
                    only: vi.fn(),
                    numeric: vi.fn(),
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
                user: vi.fn(),
                authentication: vi.fn(),
            },
        };
    });

    describe("login()", () => {
        it("should log in using validated request data", async () => {
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

            req.sanitize!.data = validatedData;
            mockLogin.mockResolvedValue(mockResult);

            await controller.login(
                req as Request,
                res as Response,
                next,
            );

            expect(mockLogin).toHaveBeenCalledWith(
                validatedData,
                expect.any(Object),
            );
            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.json).toHaveBeenCalledWith({
                token: "eyMockJwtToken",
                access_token: "eyMockJwtToken",
                expires_at: mockResult.expiresAt,
                tfa_required: false,
                tfaRequired: false,
            });

            // The refresh token is delivered as an HttpOnly cookie.
            expect(res.cookie).toHaveBeenCalledWith(
                "refresh_token",
                "mock-refresh-token",
                expect.objectContaining({httpOnly: true}),
            );

            expect(next).not.toHaveBeenCalled();
        });

        it("should forward business layer login failures", async () => {
            const validatedData = {
                username: "nonexistent",
                password: "wrongpassword",
            };

            const authError = new Error("Invalid credentials payload.");

            req.sanitize!.data = validatedData;
            mockLogin.mockRejectedValue(authError);

            await controller.login(
                req as Request,
                res as Response,
                next,
            );

            expect(mockLogin).toHaveBeenCalledWith(
                validatedData,
                expect.any(Object),
            );
            expect(next).toHaveBeenCalledWith(authError);
            expect(res.status).not.toHaveBeenCalled();
        });

    });

    describe("logout()", () => {
        it("should invalidate an active JWT token session", async () => {
            mockLogout.mockResolvedValue(undefined);

            await controller.logout(
                req as Request,
                res as Response,
                next,
            );

            expect(mockLogout).toHaveBeenCalledWith(45);
            expect(res.sendStatus).toHaveBeenCalledWith(204);
            expect(next).not.toHaveBeenCalled();
        });

        it("should pass logout errors to the error boundary", async () => {
            const logoutError = new Error(
                "Database transaction aborted during token termination.",
            );

            mockLogout.mockRejectedValue(logoutError);

            await controller.logout(
                req as Request,
                res as Response,
                next,
            );

            expect(mockLogout).toHaveBeenCalledWith(45);
            expect(next).toHaveBeenCalledWith(logoutError);
            expect(res.sendStatus).not.toHaveBeenCalled();
        });

        it("should forward errors when credentials context is missing", async () => {
            req.credentials = undefined;

            await controller.logout(
                req as Request,
                res as Response,
                next,
            );

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "The provided authentication token is invalid or missing",
                    errorCode: "INVALID_AUTH_TOKEN",
                    statusCode: 401,
                }),
            );

            expect(res.sendStatus).not.toHaveBeenCalled();
            expect(mockLogout).not.toHaveBeenCalled();
        });
    });
});