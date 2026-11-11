import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";
import Joi from "joi";
import {errorHandler} from "./error.middleware";
import {AppError} from "../utils/errors";
import Messages from "../utils/messages";
const errors = Messages;

const {
    mockLoggerError,
} = vi.hoisted(() => ({
    mockLoggerError: vi.fn(),
}));

vi.mock(
    "../../config/logger",
    () => ({
        logger: {
            error: mockLoggerError,
        },
    }),
);

describe("errorHandler", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: NextFunction;

    const invoke = (
        error: unknown,
    ) => {
        errorHandler(
            error,
            req as Request,
            res as Response,
            next,
        );
    };

    const expectJsonResponse = (
        statusCode: number,
        data: unknown,
    ) => {
        expect(res.status)
            .toHaveBeenCalledTimes(1);

        expect(res.status)
            .toHaveBeenCalledWith(statusCode);

        expect(res.json)
            .toHaveBeenCalledTimes(1);

        expect(res.json)
            .toHaveBeenCalledWith(data);

        expect(next)
            .not.toHaveBeenCalled();
    };

    beforeEach(() => {
        vi.resetAllMocks();

        req = {};

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        next = vi.fn();
    });

    describe("Joi.ValidationError", () => {
        it("should return 422 for a Joi validation error", () => {
            const schema = Joi.object({
                name: Joi.string().required(),
            });

            const {error} = schema.validate(
                {},
                {
                    abortEarly: false,
                },
            );

            expect(error)
                .toBeInstanceOf(Joi.ValidationError);

            invoke(error);

            expectJsonResponse(
                422,
                {
                    code: errors.VALIDATION_FAILED.code,
                    message: errors.VALIDATION_FAILED.message,
                    errors: [
                        {
                            field: "name",
                            message: "Name is required",
                        },
                    ],
                },
            );

            expect(mockLoggerError)
                .not.toHaveBeenCalled();
        });

        it("should transform multiple validation errors into field/message objects", () => {
            const schema = Joi.object({
                first_name: Joi.string().required(),
                last_name: Joi.string().required(),
                email: Joi.string().email().required(),
            });

            const {error} = schema.validate(
                {},
                {
                    abortEarly: false,
                },
            );

            expect(error)
                .toBeInstanceOf(Joi.ValidationError);

            invoke(error);

            expect(res.status)
                .toHaveBeenCalledWith(422);

            expect(res.json)
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

            expect(next)
                .not.toHaveBeenCalled();

            expect(mockLoggerError)
                .not.toHaveBeenCalled();
        });

        it("should convert snake_case field names into readable labels", () => {
            const schema = Joi.object({
                first_name: Joi.string().required(),
            });

            const {error} = schema.validate(
                {},
            );

            invoke(error);

            expect(res.json)
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

        it("should convert id to uppercase ID in validation messages", () => {
            const schema = Joi.object({
                user_id: Joi.number().required(),
            });

            const {error} = schema.validate(
                {},
            );

            invoke(error);

            expect(res.json)
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

        it("should preserve the original field path as the field property", () => {
            const schema = Joi.object({
                user_id: Joi.number().required(),
            });

            const {error} = schema.validate(
                {},
            );

            invoke(error);

            const response = (
                res.json as ReturnType<typeof vi.fn>
            ).mock.calls[0][0];

            expect(response.errors[0].field)
                .toBe("user_id");
        });

        it("should handle validation errors with nested paths", () => {
            const schema = Joi.object({
                user: Joi.object({
                    email: Joi.string().email().required(),
                }).required(),
            });

            const {error} = schema.validate(
                {
                    user: {},
                },
            );

            invoke(error);

            const response = (
                res.json as ReturnType<typeof vi.fn>
            ).mock.calls[0][0];

            expect(response.code)
                .toBe(errors.VALIDATION_FAILED.code);

            expect(response.message)
                .toBe(errors.VALIDATION_FAILED.message);

            expect(response.errors[0])
                .toEqual({
                    field: "user",
                    message: expect.any(String),
                });

            expect(next)
                .not.toHaveBeenCalled();
        });

        it("should process custom Joi validation messages", () => {
            const schema = Joi.object({
                username: Joi.string()
                    .required()
                    .messages({
                        "any.required": '"username" must be provided',
                    }),
            });

            const {error} = schema.validate(
                {},
            );

            invoke(error);

            expect(res.json)
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

        it("should remove surrounding quotes from Joi error messages", () => {
            const schema = Joi.object({
                user_id: Joi.number()
                    .valid(1)
                    .messages({
                        "any.only": '"user_id"',
                    }),
            });

            const {error} = schema.validate({
                user_id: 2,
            });

            invoke(error);

            const response = (
                res.json as ReturnType<typeof vi.fn>
            ).mock.calls[0][0];

            expect(response.errors[0].field)
                .toBe("user_id");

            expect(response.errors[0].message)
                .toBe("User ID");
        });

        it("should not log Joi validation errors", () => {
            const schema = Joi.object({
                email: Joi.string().email().required(),
            });

            const {error} = schema.validate(
                {},
            );

            invoke(error);

            expect(mockLoggerError)
                .not.toHaveBeenCalled();
        });
    });

    describe("AppError", () => {
        it("should return the AppError status code", () => {
            const error = new AppError(
                Messages.DATA_NOT_FOUND,
                "Resource not found",
            );

            invoke(error);

            expectJsonResponse(
                404,
                {
                    code: "DATA_NOT_FOUND",
                    message: "Resource not found",
                },
            );

            expect(mockLoggerError)
                .not.toHaveBeenCalled();
        });

        it("should return the AppError error code", () => {
            const error = new AppError(
                Messages.INVALID_REQUEST,
                "Invalid request",
            );

            invoke(error);

            expect(res.json)
                .toHaveBeenCalledWith({
                    code: "INVALID_REQUEST",
                    message: "Invalid request",
                });
        });

        it("should return the AppError message", () => {
            const error = new AppError(
                Messages.FORBIDDEN,
                "You do not have permission",
            );

            invoke(error);

            expect(res.json)
                .toHaveBeenCalledWith({
                    code: "FORBIDDEN",
                    message: "You do not have permission",
                });
        });

        it("should not log known AppErrors", () => {
            const error = new AppError(
                Messages.UNAUTHORIZED,
                "Unauthorized",
            );

            invoke(error);

            expect(mockLoggerError)
                .not.toHaveBeenCalled();
        });

        it("should use SERVER_ERROR code when AppError errorCode is falsy", () => {
            const error = new AppError(
                errors.SERVER_ERROR,
                "Something went wrong",
            );

            invoke(error);

            expectJsonResponse(
                500,
                {
                    code: errors.SERVER_ERROR.code,
                    message: "Something went wrong",
                },
            );
        });
    });

    describe("Unhandled errors", () => {
        it("should return 500 for a regular Error", () => {
            const error = new Error(
                "Database connection failed",
            );

            invoke(error);

            expectJsonResponse(
                500,
                {
                    code: errors.SERVER_ERROR.code,
                    message: errors.SERVER_ERROR.message,
                },
            );
        });

        it("should log unhandled errors", () => {
            const error = new Error(
                "Database connection failed",
            );

            invoke(error);

            // Called multiple times due to additional debug logging
            expect(mockLoggerError).toHaveBeenCalled();

            expect(mockLoggerError)
                .toHaveBeenCalledWith(
                    "Unhandled Application Exception:",
                    error,
                );
        });

        it("should log the exact error instance", () => {
            const error = new Error(
                "Unexpected failure",
            );

            invoke(error);

            const calls = (
                mockLoggerError as ReturnType<typeof vi.fn>
            ).mock.calls;

            expect(calls[0][1])
                .toBe(error);
        });

        it("should handle string errors", () => {
            const error = "Unexpected application failure";

            invoke(error);

            expectJsonResponse(
                500,
                {
                    code: errors.SERVER_ERROR.code,
                    message: errors.SERVER_ERROR.message,
                },
            );

            expect(mockLoggerError)
                .toHaveBeenCalledWith(
                    "Unhandled Application Exception:",
                    error,
                );
        });

        it("should handle null errors", () => {
            invoke(null);

            expectJsonResponse(
                500,
                {
                    code: errors.SERVER_ERROR.code,
                    message: errors.SERVER_ERROR.message,
                },
            );

            expect(mockLoggerError).toHaveBeenCalled();
            expect(mockLoggerError).toHaveBeenCalledWith(
                "Unhandled Application Exception:",
                null,
            );
        });

        it("should handle undefined errors", () => {
            invoke(undefined);

            expectJsonResponse(
                500,
                {
                    code: errors.SERVER_ERROR.code,
                    message: errors.SERVER_ERROR.message,
                },
            );

            expect(mockLoggerError).toHaveBeenCalled();
            expect(mockLoggerError).toHaveBeenCalledWith(
                "Unhandled Application Exception:",
                undefined,
            );
        });

        it("should never expose the original unknown error to the client", () => {
            const error = new Error(
                "SECRET_DATABASE_PASSWORD",
            );

            invoke(error);

            expect(res.json)
                .toHaveBeenCalledWith({
                    code: errors.SERVER_ERROR.code,
                    message: errors.SERVER_ERROR.message,
                });

            expect(res.json)
                .not.toHaveBeenCalledWith(
                expect.objectContaining({
                    message: error.message,
                }),
            );
        });

        it("should not call next for unhandled errors", () => {
            invoke(
                new Error("Unexpected error"),
            );

            expect(next)
                .not.toHaveBeenCalled();
        });
    });

    describe("middleware contract", () => {
        it("should always terminate the response for Joi errors", () => {
            const schema = Joi.object({
                name: Joi.string().required(),
            });

            const {error} = schema.validate(
                {},
            );

            invoke(error);

            expect(res.status)
                .toHaveBeenCalledTimes(1);

            expect(res.json)
                .toHaveBeenCalledTimes(1);

            expect(next)
                .not.toHaveBeenCalled();
        });

        it("should always terminate the response for AppError", () => {
            invoke(
                new AppError(
                    Messages.DATA_NOT_FOUND,
                    "Not found",
                ),
            );

            expect(res.status)
                .toHaveBeenCalledTimes(1);

            expect(res.json)
                .toHaveBeenCalledTimes(1);

            expect(next)
                .not.toHaveBeenCalled();
        });

        it("should always terminate the response for unknown errors", () => {
            invoke(
                new Error("Unknown error"),
            );

            expect(res.status)
                .toHaveBeenCalledTimes(1);

            expect(res.json)
                .toHaveBeenCalledTimes(1);

            expect(next)
                .not.toHaveBeenCalled();
        });
    });
});
