"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/common/middleware/response.middleware.spec.ts
const vitest_1 = require("vitest");
const response_middleware_1 = __importDefault(require("./response.middleware"));
const messages_1 = __importDefault(require("../utils/messages"));
(0, vitest_1.describe)("Response Middleware", () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;
    (0, vitest_1.beforeEach)(() => {
        mockRequest = {};
        mockResponse = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn(),
        };
        nextFunction = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("Initialization", () => {
        (0, vitest_1.it)("should attach failed helper methods to response object and call next", () => {
            var _a, _b;
            (0, response_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockResponse.failed).toBeDefined();
            (0, vitest_1.expect)(typeof ((_a = mockResponse.failed) === null || _a === void 0 ? void 0 : _a.message)).toBe("function");
            (0, vitest_1.expect)(typeof ((_b = mockResponse.failed) === null || _b === void 0 ? void 0 : _b.fields)).toBe("function");
            (0, vitest_1.expect)(nextFunction).toHaveBeenCalledTimes(1);
        });
    });
    (0, vitest_1.describe)("res.failed.message()", () => {
        (0, vitest_1.it)("should send correct status and system message when a valid code is provided without custom message", () => {
            var _a;
            (0, response_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (_a = mockResponse.failed) === null || _a === void 0 ? void 0 : _a.message(404, undefined, "DATA_NOT_FOUND");
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(404);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: messages_1.default.DATA_NOT_FOUND.code,
                message: messages_1.default.DATA_NOT_FOUND.message,
            });
        });
        (0, vitest_1.it)("should override the default message when a custom message is provided with a valid code", () => {
            var _a;
            (0, response_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            const customMessage = "Custom user-friendly not found message";
            (_a = mockResponse.failed) === null || _a === void 0 ? void 0 : _a.message(404, customMessage, "DATA_NOT_FOUND");
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(404);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: messages_1.default.DATA_NOT_FOUND.code,
                message: customMessage,
            });
        });
        (0, vitest_1.it)("should fallback to SERVER_ERROR when an invalid or unknown code is provided", () => {
            var _a;
            (0, response_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (_a = mockResponse.failed) === null || _a === void 0 ? void 0 : _a.message(500, undefined, "UNKNOWN_INVALID_CODE");
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(500);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: messages_1.default.SERVER_ERROR.code,
                message: messages_1.default.SERVER_ERROR.message,
            });
        });
        (0, vitest_1.it)("should fallback to SERVER_ERROR when the code argument is omitted", () => {
            var _a;
            (0, response_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (_a = mockResponse.failed) === null || _a === void 0 ? void 0 : _a.message(500, "Something broke");
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(500);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: messages_1.default.SERVER_ERROR.code,
                message: "Something broke",
            });
        });
    });
    (0, vitest_1.describe)("res.failed.fields()", () => {
        (0, vitest_1.it)("should wrap non-array validation errors into an array", () => {
            var _a;
            (0, response_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            const singleError = { field: "email", message: "Email is required" };
            (_a = mockResponse.failed) === null || _a === void 0 ? void 0 : _a.fields(422, singleError);
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(422);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: messages_1.default.VALIDATION_FAILED.code,
                message: messages_1.default.VALIDATION_FAILED.message,
                errors: [singleError],
            });
        });
        (0, vitest_1.it)("should keep validation errors as an array when an array is passed", () => {
            var _a;
            (0, response_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            const errorArray = [
                { field: "email", message: "Email is required" },
                { field: "password", message: "Password is too short" },
            ];
            (_a = mockResponse.failed) === null || _a === void 0 ? void 0 : _a.fields(422, errorArray);
            (0, vitest_1.expect)(mockResponse.status).toHaveBeenCalledWith(422);
            (0, vitest_1.expect)(mockResponse.json).toHaveBeenCalledWith({
                code: messages_1.default.VALIDATION_FAILED.code,
                message: messages_1.default.VALIDATION_FAILED.message,
                errors: errorArray,
            });
        });
    });
});
