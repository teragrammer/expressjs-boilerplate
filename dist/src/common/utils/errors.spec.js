"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/common/utils/errors.spec.ts
const vitest_1 = require("vitest");
const messages_1 = __importDefault(require("./messages"));
const errors_1 = require("./errors");
(0, vitest_1.describe)("AppError", () => {
    (0, vitest_1.it)("should correctly instantiate with error metadata from Messages", () => {
        const error = new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
        (0, vitest_1.expect)(error).toBeInstanceOf(Error);
        (0, vitest_1.expect)(error).toBeInstanceOf(errors_1.AppError);
        (0, vitest_1.expect)(error.message).toBe(messages_1.default.DATA_NOT_FOUND.message);
        (0, vitest_1.expect)(error.errorCode).toBe(messages_1.default.DATA_NOT_FOUND.code);
        (0, vitest_1.expect)(error.statusCode).toBe(messages_1.default.DATA_NOT_FOUND.status);
    });
    (0, vitest_1.it)("should allow overriding the default message with a custom message", () => {
        const customMsg = "Specific user profile could not be located";
        const error = new errors_1.AppError(messages_1.default.DATA_NOT_FOUND, customMsg);
        (0, vitest_1.expect)(error.message).toBe(customMsg);
        (0, vitest_1.expect)(error.errorCode).toBe(messages_1.default.DATA_NOT_FOUND.code);
        (0, vitest_1.expect)(error.statusCode).toBe(messages_1.default.DATA_NOT_FOUND.status);
    });
    (0, vitest_1.it)("should capture stack trace and preserve proper prototype chain", () => {
        const error = new errors_1.AppError(messages_1.default.SERVER_ERROR);
        // Check if stack trace is defined
        (0, vitest_1.expect)(error.stack).toBeDefined();
        // Verify prototype chain is correctly maintained (important for instanceof checks with custom Error subclasses)
        (0, vitest_1.expect)(Object.getPrototypeOf(error)).toBe(errors_1.AppError.prototype);
    });
});
