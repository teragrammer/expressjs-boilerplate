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
const account_controller_1 = require("./account.controller");
const { mockInformation, mockPassword } = vitest_1.vi.hoisted(() => ({
    mockInformation: vitest_1.vi.fn(),
    mockPassword: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
}));
(0, vitest_1.describe)("AccountController", () => {
    let controller;
    let req;
    let res;
    let next;
    const user = {
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
        authorization_version: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
    };
    const invoke = (method) => __awaiter(void 0, void 0, void 0, function* () {
        yield controller[method](req, res, next);
    });
    const expectSuccessfulResponse = (data) => {
        (0, vitest_1.expect)(res.status).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith(data);
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    };
    const expectErrorForwarded = (error) => {
        (0, vitest_1.expect)(next).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(next).toHaveBeenCalledWith(error);
        (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
        (0, vitest_1.expect)(res.json).not.toHaveBeenCalled();
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        const accountService = {
            information: mockInformation,
            password: mockPassword,
        };
        controller = new account_controller_1.AccountController(accountService);
        res = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn().mockReturnThis(),
        };
        next = vitest_1.vi.fn();
        req = {
            credentials: {
                jwt: {
                    tid: 45,
                    uid: 1,
                    tfa: false,
                },
                user: vitest_1.vi.fn().mockResolvedValue(user),
                authentication: vitest_1.vi.fn(),
            },
            sanitize: {
                body: {
                    only: vitest_1.vi.fn(),
                    get: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                },
                query: {
                    only: vitest_1.vi.fn(),
                    get: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
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
    (0, vitest_1.describe)("information()", () => {
        (0, vitest_1.it)("should update account information using the authenticated user ID and validated data", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                first_name: "John",
                middle_name: "Michael",
                last_name: "Doe",
                address: "456 New Street",
            };
            const token = "mocked-jwt-token-string";
            req.sanitize.data = validatedData;
            mockInformation.mockResolvedValue(token);
            yield invoke("information");
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledWith(1, validatedData, 45, // currentTid
            false);
            (0, vitest_1.expect)(req.sanitize.body.only).not.toHaveBeenCalled();
            expectSuccessfulResponse(token);
        }));
        (0, vitest_1.it)("should use the authenticated user's UID instead of a request body ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                first_name: "Jane",
                middle_name: null,
                last_name: "Smith",
                address: "789 Another Street",
            };
            req.credentials.jwt.uid = 42;
            req.sanitize.data = validatedData;
            mockInformation.mockResolvedValue("new-token");
            yield invoke("information");
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledWith(42, validatedData, 45, // currentTid (unchanged)
            false);
            (0, vitest_1.expect)(mockInformation).not.toHaveBeenCalledWith(vitest_1.expect.anything(), vitest_1.expect.objectContaining({
                id: vitest_1.expect.anything(),
            }));
            expectSuccessfulResponse("new-token");
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                first_name: "John",
                middle_name: "Michael",
                last_name: "Doe",
                address: "456 New Street",
            };
            const serviceError = new Error("Failed to update account information");
            req.sanitize.data = validatedData;
            mockInformation.mockRejectedValue(serviceError);
            yield invoke("information");
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledWith(1, validatedData, 45, false);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when credentials are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.credentials;
            yield invoke("password");
            (0, vitest_1.expect)(mockPassword).not.toHaveBeenCalled();
            (0, vitest_1.expect)(next).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                message: "The provided authentication token is invalid or missing",
                errorCode: "INVALID_AUTH_TOKEN",
                statusCode: 401,
            }));
            (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.json).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("information");
            (0, vitest_1.expect)(mockInformation).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an unexpected service result to the response", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.data = {
                first_name: "John",
                last_name: "Doe",
            };
            mockInformation.mockResolvedValue(undefined);
            yield invoke("information");
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockInformation).toHaveBeenCalledWith(1, req.sanitize.data, 45, false);
            expectSuccessfulResponse(undefined);
        }));
    });
    (0, vitest_1.describe)("password()", () => {
        (0, vitest_1.it)("should update account password using the authenticated user and validated data", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
                username: "johndoe",
                email: "john@example.com",
                phone: "+1234567890",
            };
            const token = "mocked-password-update-token";
            req.sanitize.data = validatedData;
            mockPassword.mockResolvedValue(token);
            yield invoke("password");
            (0, vitest_1.expect)(req.credentials.user).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(req.credentials.user).toHaveBeenCalledWith();
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledWith(user, validatedData, 45);
            (0, vitest_1.expect)(req.sanitize.body.only).not.toHaveBeenCalled();
            expectSuccessfulResponse(token);
        }));
        (0, vitest_1.it)("should pass the exact user returned by credentials.user() to the service", () => __awaiter(void 0, void 0, void 0, function* () {
            const authenticatedUser = Object.assign(Object.assign({}, user), { id: 99, username: "authenticated-user" });
            const validatedData = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };
            req.credentials.user.mockResolvedValue(authenticatedUser);
            req.sanitize.data = validatedData;
            mockPassword.mockResolvedValue("new-token");
            yield invoke("password");
            (0, vitest_1.expect)(req.credentials.user).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledWith(authenticatedUser, validatedData, 45);
            expectSuccessfulResponse("new-token");
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                current_password: "WrongPassword123!",
                new_password: "NewPassword123!",
            };
            const serviceError = new Error("Current password does not match");
            req.sanitize.data = validatedData;
            mockPassword.mockRejectedValue(serviceError);
            yield invoke("password");
            (0, vitest_1.expect)(req.credentials.user).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledWith(user, validatedData, 45);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward credentials.user() errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const authenticationError = new Error("Unable to resolve authenticated user");
            req.credentials.user.mockRejectedValue(authenticationError);
            yield invoke("password");
            (0, vitest_1.expect)(req.credentials.user).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPassword).not.toHaveBeenCalled();
            expectErrorForwarded(authenticationError);
        }));
        (0, vitest_1.it)("should forward an error when credentials are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.credentials;
            yield invoke("information");
            (0, vitest_1.expect)(mockInformation).not.toHaveBeenCalled();
            (0, vitest_1.expect)(next).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                message: "The provided authentication token is invalid or missing",
                errorCode: "INVALID_AUTH_TOKEN",
                statusCode: 401,
            }));
            (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.json).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("password");
            (0, vitest_1.expect)(mockPassword).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should pass undefined sanitized data to the service without performing validation", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.data = undefined;
            mockPassword.mockResolvedValue("token");
            yield invoke("password");
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPassword).toHaveBeenCalledWith(user, undefined, 45);
            expectSuccessfulResponse("token");
        }));
    });
});
