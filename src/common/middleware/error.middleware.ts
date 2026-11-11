// src/common/middleware/error.middleware.ts
import {NextFunction, Request, Response} from "express";
import Joi from "joi";
import {logger} from "../../config/logger";
import errors from "../utils/messages";
import {AppError} from "../utils/errors";

export const errorHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    // Handle Joi validation failures cleanly.
    if (err instanceof Joi.ValidationError) {
        res.status(422).json({
            code: errors.VALIDATION_FAILED.code,
            message: errors.VALIDATION_FAILED.message,
            errors: err.details.map(
                (detail: Joi.ValidationErrorItem) => {
                    const field = String(
                        detail.path[0] ?? "",
                    );

                    const formattedField = field
                        .split("_")
                        .map((word: string) => {
                            const normalizedWord =
                                word.toLowerCase();

                            return normalizedWord === "id"
                                ? "ID"
                                : normalizedWord
                                    .charAt(0)
                                    .toUpperCase()
                                + normalizedWord.slice(1);
                        })
                        .join(" ");

                    let message = detail.message;

                    // Remove the quoted Joi field name from the message.
                    message = message
                        .replace(/^"[^"]+"\s*/, "")
                        .replace(/^'[^']+'\s*/, "");

                    return {
                        field,
                        message: message
                            ? `${formattedField} ${message}`
                            : formattedField,
                    };
                },
            ),
        });

        return;
    }

    // If it's our known custom AppError, use its status code.
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            code: err.errorCode || errors.SERVER_ERROR.code,
            message: err.message,
        });

        return;
    }

    // Fallback for unexpected system failures.
    logger.error(
        "Unhandled Application Exception:",
        err,
    );
    logger.error(`Error stack: ${err?.stack}`);
    logger.error(`Error type: ${typeof err}`);
    logger.error(`Error constructor: ${err?.constructor?.name}`);
    logger.error(`Error keys: ${err ? Object.keys(err) : "null"}`);
    logger.error(`Error JSON: ${err ? JSON.stringify(err, Object.getOwnPropertyNames(err)) : "null"}`);

    res.status(500).json({
        code: errors.SERVER_ERROR.code,
        message: errors.SERVER_ERROR.message,
    });
};
