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
const register_controller_1 = require("./register.controller");
const { mockRegister, auditService } = vitest_1.vi.hoisted(() => ({
    mockRegister: vitest_1.vi.fn(),
    auditService: {
        success: vitest_1.vi.fn(),
        failure: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
}));
(0, vitest_1.describe)("RegisterController", () => {
    let controller;
    let req;
    let res;
    let next;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        const authService = {
            register: mockRegister,
        };
        controller = new register_controller_1.RegisterController(authService, auditService);
        res = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn().mockReturnThis(),
            cookie: vitest_1.vi.fn().mockReturnThis(),
            clearCookie: vitest_1.vi.fn().mockReturnThis(),
        };
        next = vitest_1.vi.fn();
        req = {
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
                    last_name: "Doe",
                    username: "johndoe",
                    password: "password123",
                    email: "john@example.com",
                },
            },
        };
    });
    (0, vitest_1.describe)("create()", () => {
        (0, vitest_1.it)("should register a user using validated request data", () => __awaiter(void 0, void 0, void 0, function* () {
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
            req.sanitize.data = validatedData;
            mockRegister.mockResolvedValue(result);
            yield controller.create(req, res, next);
            (0, vitest_1.expect)(mockRegister).toHaveBeenCalledWith(validatedData, vitest_1.expect.any(Object));
            // Validation belongs to the validation middleware,
            // not the controller.
            (0, vitest_1.expect)(req.sanitize.body.only).not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(201);
            (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({
                token: "mocked-jwt-token-string",
                access_token: "mocked-jwt-token-string",
                expires_at: result.expiresAt,
                tfa_required: false,
            });
            // The refresh token is delivered as an HttpOnly cookie.
            (0, vitest_1.expect)(res.cookie).toHaveBeenCalledWith("refresh_token", "mock-refresh-token", vitest_1.expect.objectContaining({ httpOnly: true }));
            (0, vitest_1.expect)(next).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward business logic exceptions to next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const validatedData = {
                first_name: "John",
                last_name: "Doe",
                username: "johndoe",
                password: "password123",
                email: "john@example.com",
            };
            const businessError = new Error("Email address already registered");
            req.sanitize.data = validatedData;
            mockRegister.mockRejectedValue(businessError);
            yield controller.create(req, res, next);
            (0, vitest_1.expect)(mockRegister).toHaveBeenCalledWith(validatedData, vitest_1.expect.any(Object));
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(businessError);
            (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.json).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should forward errors when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield controller.create(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.any(TypeError));
            (0, vitest_1.expect)(mockRegister).not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
        }));
    });
});
