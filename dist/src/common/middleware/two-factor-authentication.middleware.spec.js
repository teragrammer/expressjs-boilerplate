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
// src/common/middleware/two-factor-authentication.middleware.spec.ts
const vitest_1 = require("vitest");
const two_factor_authentication_middleware_1 = require("./two-factor-authentication.middleware");
const messages_1 = __importDefault(require("../utils/messages"));
const request_credentials_1 = require("../utils/request-credentials");
// Mock the request-credentials utility
vitest_1.vi.mock("../utils/request-credentials", () => ({
    assertCredentials: vitest_1.vi.fn(),
}));
(0, vitest_1.describe)("TwoFactorAuthenticationMiddleware", () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockRequest = {};
        mockResponse = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn(),
        };
        nextFunction = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("When req.credentials is missing", () => {
        (0, vitest_1.it)("should return 401 with AUTH_OTP_EXPIRED when isHalt is true (default)", () => __awaiter(void 0, void 0, void 0, function* () {
            const middleware = (0, two_factor_authentication_middleware_1.TwoFactorAuthenticationMiddleware)(true);
            yield middleware(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(401);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: "AUTH_OTP_EXPIRED",
                message: messages_1.default.EXPIRED_AUTH_TOKEN.message,
            });
            (0, vitest_1.expect)(nextFunction).not.toHaveBeenCalled();
            (0, vitest_1.expect)(request_credentials_1.assertCredentials).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should call next() without responding when isHalt is false", () => __awaiter(void 0, void 0, void 0, function* () {
            const middleware = (0, two_factor_authentication_middleware_1.TwoFactorAuthenticationMiddleware)(false);
            yield middleware(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockResponse.status).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockResponse.json).not.toHaveBeenCalled();
            (0, vitest_1.expect)(nextFunction).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(request_credentials_1.assertCredentials).not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("When req.credentials is present", () => {
        (0, vitest_1.beforeEach)(() => {
            mockRequest.credentials = {
                jwt: {
                    tfa: false,
                    // Add other required mock JWT properties if needed by type constraints
                },
                user: vitest_1.vi.fn(),
                authentication: vitest_1.vi.fn(),
            };
        });
        (0, vitest_1.it)("should call assertCredentials and return 403 with AUTH_OTP_INCOMPLETE when tfa is falsy", () => __awaiter(void 0, void 0, void 0, function* () {
            const middleware = (0, two_factor_authentication_middleware_1.TwoFactorAuthenticationMiddleware)();
            yield middleware(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(request_credentials_1.assertCredentials).toHaveBeenCalledWith(mockRequest);
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(403);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: "AUTH_OTP_INCOMPLETE",
                message: messages_1.default.INCOMPLETE_OTP.message,
            });
            (0, vitest_1.expect)(nextFunction).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should call assertCredentials and invoke next() when tfa is truthy", () => __awaiter(void 0, void 0, void 0, function* () {
            if (mockRequest.credentials) {
                mockRequest.credentials.jwt.tfa = true;
            }
            const middleware = (0, two_factor_authentication_middleware_1.TwoFactorAuthenticationMiddleware)();
            yield middleware(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(request_credentials_1.assertCredentials).toHaveBeenCalledWith(mockRequest);
            (0, vitest_1.expect)(mockResponse.status).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockResponse.json).not.toHaveBeenCalled();
            (0, vitest_1.expect)(nextFunction).toHaveBeenCalledTimes(1);
        }));
    });
});
