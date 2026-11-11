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
// src/common/utils/request-credentials.spec.ts
const vitest_1 = require("vitest");
const request_credentials_1 = require("./request-credentials");
const messages_1 = require("./messages");
const errors_1 = require("./errors");
(0, vitest_1.describe)("assertCredentials", () => {
    (0, vitest_1.it)("should pass silently and narrow the type when credentials are present", () => {
        const mockRequest = {
            credentials: {
                jwt: {},
                user: () => __awaiter(void 0, void 0, void 0, function* () { return ({}); }),
                authentication: () => __awaiter(void 0, void 0, void 0, function* () { return ({}); }),
            },
        };
        (0, vitest_1.expect)(() => (0, request_credentials_1.assertCredentials)(mockRequest)).not.toThrow();
    });
    (0, vitest_1.it)("should throw an AppError with 401 status and correct code/message when credentials are missing", () => {
        const mockRequest = {};
        try {
            (0, request_credentials_1.assertCredentials)(mockRequest);
            vitest_1.expect.fail("Expected assertCredentials to throw an error");
        }
        catch (error) {
            (0, vitest_1.expect)(error).toBeInstanceOf(errors_1.AppError);
            (0, vitest_1.expect)(error.statusCode).toBe(401);
            (0, vitest_1.expect)(error.errorCode).toBe(messages_1.Messages.INVALID_AUTH_TOKEN.code);
            (0, vitest_1.expect)(error.message).toBe(messages_1.Messages.INVALID_AUTH_TOKEN.message);
        }
    });
});
