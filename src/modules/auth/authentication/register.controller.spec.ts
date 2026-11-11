import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {RegisterController} from "./register.controller";
import {AuthenticationService} from "./authentication.service";
import {AuditService} from "../../audit/audit.service";

const {mockRegister, auditService} = vi.hoisted(() => ({
    mockRegister: vi.fn(),
    auditService: {
        success: vi.fn(),
        failure: vi.fn(),
    },
}));

vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn: any) => (req: any, res: any, next: any) =>
        Promise.resolve(fn(req, res, next)).catch(next),
}));

describe("RegisterController", () => {
    let controller: RegisterController;

    let req: Partial<Request> & {
        sanitize?: any;
    };

    let res: Partial<Response>;
    let next: NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();

        const authService = {
            register: mockRegister,
        } as unknown as AuthenticationService;

        controller = new RegisterController(
            authService,
            auditService as unknown as AuditService,
        );

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            cookie: vi.fn().mockReturnThis(),
            clearCookie: vi.fn().mockReturnThis(),
        };

        next = vi.fn();

        req = {
            sanitize: {
                body: {
                    only: vi.fn(),
                    get: vi.fn(),
                    numeric: vi.fn(),
                },
                query: {
                    only: vi.fn(),
                    get: vi.fn(),
                    numeric: vi.fn(),
                },
                data: {
                    first_name: "John",
                    last_name: "Doe",
                    username: "johndoe",
                    password: "password123",
                    email: "john@example.com",
                },
            },
        };
    });

    describe("create()", () => {
        it("should register a user using validated request data", async () => {
            const validatedData = {
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                password: "password123",
                email: "john@example.com",
            };

            const result = {
                accessToken: "mocked-jwt-token-string",
                refreshToken: "mock-refresh-token",
                sessionId: 12,
                expiresAt: new Date("2030-01-01T00:00:00.000Z"),
                tfaRequired: false,
            };

            req.sanitize!.data = validatedData;

            mockRegister.mockResolvedValue(result);

            await controller.create(
                req as Request,
                res as Response,
                next,
            );

            expect(mockRegister).toHaveBeenCalledWith(
                validatedData,
                expect.any(Object),
            );

            // Validation belongs to the validation middleware,
            // not the controller.
            expect(req.sanitize!.body.only).not.toHaveBeenCalled();

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                token: "mocked-jwt-token-string",
                access_token: "mocked-jwt-token-string",
                expires_at: result.expiresAt,
                tfa_required: false,
            });

            // The refresh token is delivered as an HttpOnly cookie.
            expect(res.cookie).toHaveBeenCalledWith(
                "refresh_token",
                "mock-refresh-token",
                expect.objectContaining({httpOnly: true}),
            );

            expect(next).not.toHaveBeenCalled();
        });

        it("should forward business logic exceptions to next middleware", async () => {
            const validatedData = {
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                password: "password123",
                email: "john@example.com",
            };

            const businessError = new Error(
                "Email address already registered",
            );

            req.sanitize!.data = validatedData;

            mockRegister.mockRejectedValue(businessError);

            await controller.create(
                req as Request,
                res as Response,
                next,
            );

            expect(mockRegister).toHaveBeenCalledWith(
                validatedData,
                expect.any(Object),
            );
            expect(next).toHaveBeenCalledWith(businessError);
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it("should forward errors when sanitize context is missing", async () => {
            delete req.sanitize;

            await controller.create(
                req as Request,
                res as Response,
                next,
            );

            expect(next).toHaveBeenCalledWith(expect.any(TypeError));
            expect(mockRegister).not.toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });
});