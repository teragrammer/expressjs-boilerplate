"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const joi_1 = __importDefault(require("joi"));
const error_middleware_1 = require("./error.middleware");
const errors_1 = require("../utils/errors");
const messages_1 = __importDefault(require("../utils/messages"));
const errors = messages_1.default;
const { mockLoggerError, } = vitest_1.vi.hoisted(() => ({
    mockLoggerError: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../config/logger", () => ({
    logger: {
        error: mockLoggerError,
    },
}));
(0, vitest_1.describe)("errorHandler", () => {
    let req;
    let res;
    let next;
    const invoke = (error) => {
        (0, error_middleware_1.errorHandler)(error, req, res, next);
    };
    const expectJsonResponse = (statusCode, data) => {
        (0, vitest_1.expect)(res.status)
            .toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status)
            .toHaveBeenCalledWith(statusCode);
        (0, vitest_1.expect)(res.json)
            .toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.json)
            .toHaveBeenCalledWith(data);
        (0, vitest_1.expect)(next)
            .not.toHaveBeenCalled();
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetAllMocks();
        req = {};
        res = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn().mockReturnThis(),
        };
        next = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("Joi.ValidationError", () => {
        (0, vitest_1.it)("should return 422 for a Joi validation error", () => {
            const schema = joi_1.default.object({
                name: joi_1.default.string().required(),
            });
            const { error } = schema.validate({}, {
                abortEarly: false,
            });
            (0, vitest_1.expect)(error)
                .toBeInstanceOf(joi_1.default.ValidationError);
            invoke(error);
            expectJsonResponse(422, {
                code: errors.VALIDATION_FAILED.code,
                message: errors.VALIDATION_FAILED.message,
                errors: [
                    {
                        field: "name",
                        message: "Name is required",
                    },
                ],
            });
            (0, vitest_1.expect)(mockLoggerError)
                .not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("should transform multiple validation errors into field/message objects", () => {
            const schema = joi_1.default.object({
                first_name: joi_1.default.string().required(),
                last_name: joi_1.default.string().required(),
                email: joi_1.default.string().email().required(),
            });
            const { error } = schema.validate({}, {
                abortEarly: false,
            });
            (0, vitest_1.expect)(error)
                .toBeInstanceOf(joi_1.default.ValidationError);
            invoke(error);
            (0, vitest_1.expect)(res.status)
                .toHaveBeenCalledWith(422);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: errors.VALIDATION_FAILED.code,
                message: errors.VALIDATION_FAILED.message,
                errors: [
                    {
                        field: "first_name",
                        message: "First Name is required",
                    },
                    {
                        field: "last_name",
                        message: "Last Name is required",
                    },
                    {
                        field: "email",
                        message: "Email is required",
                    },
                ],
            });
            (0, vitest_1.expect)(next)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockLoggerError)
                .not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("should convert snake_case field names into readable labels", () => {
            const schema = joi_1.default.object({
                first_name: joi_1.default.string().required(),
            });
            const { error } = schema.validate({});
            invoke(error);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: errors.VALIDATION_FAILED.code,
                message: errors.VALIDATION_FAILED.message,
                errors: [
                    {
                        field: "first_name",
                        message: "First Name is required",
                    },
                ],
            });
        });
        (0, vitest_1.it)("should convert id to uppercase ID in validation messages", () => {
            const schema = joi_1.default.object({
                user_id: joi_1.default.number().required(),
            });
            const { error } = schema.validate({});
            invoke(error);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: errors.VALIDATION_FAILED.code,
                message: errors.VALIDATION_FAILED.message,
                errors: [
                    {
                        field: "user_id",
                        message: "User ID is required",
                    },
                ],
            });
        });
        (0, vitest_1.it)("should preserve the original field path as the field property", () => {
            const schema = joi_1.default.object({
                user_id: joi_1.default.number().required(),
            });
            const { error } = schema.validate({});
            invoke(error);
            const response = res.json.mock.calls[0][0];
            (0, vitest_1.expect)(response.errors[0].field)
                .toBe("user_id");
        });
        (0, vitest_1.it)("should handle validation errors with nested paths", () => {
            const schema = joi_1.default.object({
                user: joi_1.default.object({
                    email: joi_1.default.string().email().required(),
                }).required(),
            });
            const { error } = schema.validate({
                user: {},
            });
            invoke(error);
            const response = res.json.mock.calls[0][0];
            (0, vitest_1.expect)(response.code)
                .toBe(errors.VALIDATION_FAILED.code);
            (0, vitest_1.expect)(response.message)
                .toBe(errors.VALIDATION_FAILED.message);
            (0, vitest_1.expect)(response.errors[0])
                .toEqual({
                field: "user",
                message: vitest_1.expect.any(String),
            });
            (0, vitest_1.expect)(next)
                .not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("should process custom Joi validation messages", () => {
            const schema = joi_1.default.object({
                username: joi_1.default.string()
                    .required()
                    .messages({
                    "any.required": '"username" must be provided',
                }),
            });
            const { error } = schema.validate({});
            invoke(error);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: errors.VALIDATION_FAILED.code,
                message: errors.VALIDATION_FAILED.message,
                errors: [
                    {
                        field: "username",
                        message: "Username must be provided",
                    },
                ],
            });
        });
        (0, vitest_1.it)("should remove surrounding quotes from Joi error messages", () => {
            const schema = joi_1.default.object({
                user_id: joi_1.default.number()
                    .valid(1)
                    .messages({
                    "any.only": '"user_id"',
                }),
            });
            const { error } = schema.validate({
                user_id: 2,
            });
            invoke(error);
            const response = res.json.mock.calls[0][0];
            (0, vitest_1.expect)(response.errors[0].field)
                .toBe("user_id");
            (0, vitest_1.expect)(response.errors[0].message)
                .toBe("User ID");
        });
        (0, vitest_1.it)("should not log Joi validation errors", () => {
            const schema = joi_1.default.object({
                email: joi_1.default.string().email().required(),
            });
            const { error } = schema.validate({});
            invoke(error);
            (0, vitest_1.expect)(mockLoggerError)
                .not.toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)("AppError", () => {
        (0, vitest_1.it)("should return the AppError status code", () => {
            const error = new errors_1.AppError(messages_1.default.DATA_NOT_FOUND, "Resource not found");
            invoke(error);
            expectJsonResponse(404, {
                code: "DATA_NOT_FOUND",
                message: "Resource not found",
            });
            (0, vitest_1.expect)(mockLoggerError)
                .not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("should return the AppError error code", () => {
            const error = new errors_1.AppError(messages_1.default.INVALID_REQUEST, "Invalid request");
            invoke(error);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: "INVALID_REQUEST",
                message: "Invalid request",
            });
        });
        (0, vitest_1.it)("should return the AppError message", () => {
            const error = new errors_1.AppError(messages_1.default.FORBIDDEN, "You do not have permission");
            invoke(error);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: "FORBIDDEN",
                message: "You do not have permission",
            });
        });
        (0, vitest_1.it)("should not log known AppErrors", () => {
            const error = new errors_1.AppError(messages_1.default.UNAUTHORIZED, "Unauthorized");
            invoke(error);
            (0, vitest_1.expect)(mockLoggerError)
                .not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("should use SERVER_ERROR code when AppError errorCode is falsy", () => {
            const error = new errors_1.AppError(errors.SERVER_ERROR, "Something went wrong");
            invoke(error);
            expectJsonResponse(500, {
                code: errors.SERVER_ERROR.code,
                message: "Something went wrong",
            });
        });
    });
    (0, vitest_1.describe)("Unhandled errors", () => {
        (0, vitest_1.it)("should return 500 for a regular Error", () => {
            const error = new Error("Database connection failed");
            invoke(error);
            expectJsonResponse(500, {
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        });
        (0, vitest_1.it)("should log unhandled errors", () => {
            const error = new Error("Database connection failed");
            invoke(error);
            (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalled();
            (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                err: vitest_1.expect.objectContaining({
                    message: "Database connection failed",
                    name: "Error",
                }),
            }), "Unhandled Application Exception");
        });
        (0, vitest_1.it)("should log the error details without leaking them in the response", () => {
            const error = new Error("Unexpected failure");
            invoke(error);
            const calls = mockLoggerError.mock.calls;
            const [context] = calls[0];
            (0, vitest_1.expect)(context.err.message).toBe("Unexpected failure");
            (0, vitest_1.expect)(context.err.stack).toBeTruthy();
            // The response body must never contain the stack trace.
            expectJsonResponse(500, {
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        });
        (0, vitest_1.it)("should handle string errors", () => {
            const error = "Unexpected application failure";
            invoke(error);
            expectJsonResponse(500, {
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
            (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                err: vitest_1.expect.objectContaining({
                    message: "Unexpected application failure",
                }),
            }), "Unhandled Application Exception");
        });
        (0, vitest_1.it)("should handle null errors", () => {
            invoke(null);
            expectJsonResponse(500, {
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
            (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalled();
            (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                err: vitest_1.expect.any(Object),
            }), "Unhandled Application Exception");
        });
        (0, vitest_1.it)("should handle undefined errors", () => {
            invoke(undefined);
            expectJsonResponse(500, {
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
            (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalled();
            (0, vitest_1.expect)(mockLoggerError).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                err: vitest_1.expect.any(Object),
            }), "Unhandled Application Exception");
        });
        (0, vitest_1.it)("should never expose the original unknown error to the client", () => {
            const error = new Error("SECRET_DATABASE_PASSWORD");
            invoke(error);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledWith({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
            (0, vitest_1.expect)(res.json)
                .not.toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                message: error.message,
            }));
        });
        (0, vitest_1.it)("should not call next for unhandled errors", () => {
            invoke(new Error("Unexpected error"));
            (0, vitest_1.expect)(next)
                .not.toHaveBeenCalled();
        });
    });
    (0, vitest_1.describe)("middleware contract", () => {
        (0, vitest_1.it)("should always terminate the response for Joi errors", () => {
            const schema = joi_1.default.object({
                name: joi_1.default.string().required(),
            });
            const { error } = schema.validate({});
            invoke(error);
            (0, vitest_1.expect)(res.status)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next)
                .not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("should always terminate the response for AppError", () => {
            invoke(new errors_1.AppError(messages_1.default.DATA_NOT_FOUND, "Not found"));
            (0, vitest_1.expect)(res.status)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next)
                .not.toHaveBeenCalled();
        });
        (0, vitest_1.it)("should always terminate the response for unknown errors", () => {
            invoke(new Error("Unknown error"));
            (0, vitest_1.expect)(res.status)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(res.json)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next)
                .not.toHaveBeenCalled();
        });
    });
});
