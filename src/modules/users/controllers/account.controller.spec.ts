import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {AccountController} from "./account.controller";
import {AccountService} from "../services/account.service";
import {User} from "../user.interface";

const {mockInformation, mockPassword} = vi.hoisted(() => ({
    mockInformation: vi.fn(),
    mockPassword: vi.fn(),
}));

vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn: any) => (req: any, res: any, next: any) =>
        Promise.resolve(fn(req, res, next)).catch(next),
}));

describe("AccountController", () => {
    let controller: AccountController;

    let req: Partial<Request> & {
        sanitize?: any;
        credentials?: any;
    };

    let res: Partial<Response>;
    let next: NextFunction;

    const user: User = {
        id: 1,
        first_name: "John",
        middle_name: null,
        last_name: "Doe",
        gender: null,
        address: "123 Main Street",
        phone: "+1234567890",
        is_phone_verified: true,
        email: "john@example.com",
        is_email_verified: true,
        has_tfa: false,
        tfa_secret: null,
        role_id: 1,
        username: "johndoe",
        password: "$2b$10$hashed-password",
        status: "Activated",
        login_tries: 0,
        failed_login_expired_at: null,
        comments: null,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
    };

    type ControllerMethod = "information" | "password";

    const invoke = async (method: ControllerMethod) => {
        await controller[method](
            req as Request,
            res as Response,
            next,
        );
    };

    const expectSuccessfulResponse = (data: unknown) => {
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);

        expect(res.json).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(data);

        expect(next).not.toHaveBeenCalled();
    };

    const expectErrorForwarded = (error: unknown) => {
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        vi.clearAllMocks();

        const accountService = {
            information: mockInformation,
            password: mockPassword,
        } as unknown as AccountService;

        controller = new AccountController(accountService);

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();

        req = {
            credentials: {
                jwt: {
                    tid: 45,
                    uid: 1,
                    tfa: false,
                },
                user: vi.fn().mockResolvedValue(user),
                authentication: vi.fn(),
            },

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
                    middle_name: "Michael",
                    last_name: "Doe",
                    address: "456 New Street",
                },
            },
        };
    });

    describe("information()", () => {
        it("should update account information using the authenticated user ID and validated data", async () => {
            const validatedData = {
                first_name: "John",
                middle_name: "Michael",
                last_name: "Doe",
                address: "456 New Street",
            };

            const token = "mocked-jwt-token-string";

            req.sanitize!.data = validatedData;
            mockInformation.mockResolvedValue(token);

            await invoke("information");

            expect(mockInformation).toHaveBeenCalledTimes(1);
            expect(mockInformation).toHaveBeenCalledWith(
                1,
                validatedData,
                45,  // currentTid
                false,
            );

            expect(req.sanitize!.body.only).not.toHaveBeenCalled();

            expectSuccessfulResponse(token);
        });

        it("should use the authenticated user's UID instead of a request body ID", async () => {
            const validatedData = {
                first_name: "Jane",
                middle_name: null,
                last_name: "Smith",
                address: "789 Another Street",
            };

            req.credentials!.jwt.uid = 42;
            req.sanitize!.data = validatedData;

            mockInformation.mockResolvedValue("new-token");

            await invoke("information");

            expect(mockInformation).toHaveBeenCalledTimes(1);
            expect(mockInformation).toHaveBeenCalledWith(
                42,
                validatedData,
                45,  // currentTid (unchanged)
                false,
            );

            expect(mockInformation).not.toHaveBeenCalledWith(
                expect.anything(),
                expect.objectContaining({
                    id: expect.anything(),
                }),
            );

            expectSuccessfulResponse("new-token");
        });

        it("should forward service errors to the next middleware", async () => {
            const validatedData = {
                first_name: "John",
                middle_name: "Michael",
                last_name: "Doe",
                address: "456 New Street",
            };

            const serviceError = new Error(
                "Failed to update account information",
            );

            req.sanitize!.data = validatedData;
            mockInformation.mockRejectedValue(serviceError);

            await invoke("information");

            expect(mockInformation).toHaveBeenCalledTimes(1);
            expect(mockInformation).toHaveBeenCalledWith(
                1,
                validatedData,
                45,
                false,
            );

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when credentials are missing", async () => {
            delete req.credentials;

            await invoke("password");

            expect(mockPassword).not.toHaveBeenCalled();

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "The provided authentication token is invalid or missing",
                    errorCode: "INVALID_AUTH_TOKEN",
                    statusCode: 401,
                }),
            );

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("information");

            expect(mockInformation).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });

        it("should forward an unexpected service result to the response", async () => {
            req.sanitize!.data = {
                first_name: "John",
                last_name: "Doe",
            };

            mockInformation.mockResolvedValue(undefined);

            await invoke("information");

            expect(mockInformation).toHaveBeenCalledTimes(1);
            expect(mockInformation).toHaveBeenCalledWith(
                1,
                req.sanitize!.data,
                45,
                false,
            );

            expectSuccessfulResponse(undefined);
        });
    });

    describe("password()", () => {
        it("should update account password using the authenticated user and validated data", async () => {
            const validatedData = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
                username: "johndoe",
                email: "john@example.com",
                phone: "+1234567890",
            };

            const token = "mocked-password-update-token";

            req.sanitize!.data = validatedData;
            mockPassword.mockResolvedValue(token);

            await invoke("password");

            expect(req.credentials!.user).toHaveBeenCalledTimes(1);
            expect(req.credentials!.user).toHaveBeenCalledWith();

            expect(mockPassword).toHaveBeenCalledTimes(1);
            expect(mockPassword).toHaveBeenCalledWith(
                user,
                validatedData,
                45,  // currentTid
            );

            expect(req.sanitize!.body.only).not.toHaveBeenCalled();

            expectSuccessfulResponse(token);
        });

        it("should pass the exact user returned by credentials.user() to the service", async () => {
            const authenticatedUser = {
                ...user,
                id: 99,
                username: "authenticated-user",
            };

            const validatedData = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            req.credentials!.user.mockResolvedValue(authenticatedUser);
            req.sanitize!.data = validatedData;

            mockPassword.mockResolvedValue("new-token");

            await invoke("password");

            expect(req.credentials!.user).toHaveBeenCalledTimes(1);

            expect(mockPassword).toHaveBeenCalledTimes(1);
            expect(mockPassword).toHaveBeenCalledWith(
                authenticatedUser,
                validatedData,
                45,  // currentTid
            );

            expectSuccessfulResponse("new-token");
        });

        it("should forward service errors to the next middleware", async () => {
            const validatedData = {
                current_password: "WrongPassword123!",
                new_password: "NewPassword123!",
            };

            const serviceError = new Error(
                "Current password does not match",
            );

            req.sanitize!.data = validatedData;
            mockPassword.mockRejectedValue(serviceError);

            await invoke("password");

            expect(req.credentials!.user).toHaveBeenCalledTimes(1);

            expect(mockPassword).toHaveBeenCalledTimes(1);
            expect(mockPassword).toHaveBeenCalledWith(
                user,
                validatedData,
                45,
            );

            expectErrorForwarded(serviceError);
        });

        it("should forward credentials.user() errors to the next middleware", async () => {
            const authenticationError = new Error(
                "Unable to resolve authenticated user",
            );

            req.credentials!.user.mockRejectedValue(authenticationError);

            await invoke("password");

            expect(req.credentials!.user).toHaveBeenCalledTimes(1);
            expect(mockPassword).not.toHaveBeenCalled();

            expectErrorForwarded(authenticationError);
        });

        it("should forward an error when credentials are missing", async () => {
            delete req.credentials;

            await invoke("information");

            expect(mockInformation).not.toHaveBeenCalled();

            expect(next).toHaveBeenCalledTimes(1);
            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "The provided authentication token is invalid or missing",
                    errorCode: "INVALID_AUTH_TOKEN",
                    statusCode: 401,
                }),
            );

            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("password");

            expect(mockPassword).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });

        it("should pass undefined sanitized data to the service without performing validation", async () => {
            req.sanitize!.data = undefined;

            mockPassword.mockResolvedValue("token");

            await invoke("password");

            expect(mockPassword).toHaveBeenCalledTimes(1);
            expect(mockPassword).toHaveBeenCalledWith(
                user,
                undefined,
                45,
            );

            expectSuccessfulResponse("token");
        });
    });
});