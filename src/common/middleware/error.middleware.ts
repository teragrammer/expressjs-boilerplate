// src/common/middleware/error.middleware.ts
import {NextFunction, Request, Response} from "express";
import Joi from "joi";
import {logger} from "../../config/logger";
import errors from "../utils/messages";
import {AppError} from "../utils/errors";
import {mapDatabaseError} from "../utils/db-error.mapper";
import {getRequestId} from "../context/request-context";

/**
 * Formats a Joi validation failure into the API error envelope.
 */
function formatValidationErrors(err: Joi.ValidationError) {
    return err.details.map((detail: Joi.ValidationErrorItem) => {
        const field = String(detail.path[0] ?? "");

        const formattedField = field
            .split("_")
            .map((word: string) => {
                const normalizedWord = word.toLowerCase();

                return normalizedWord === "id"
                    ? "ID"
                    : normalizedWord.charAt(0).toUpperCase() +
                        normalizedWord.slice(1);
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
    });
}

/**
 * Serializes an unknown thrown value into a loggable shape.
 *
 * Thrown values are not guaranteed to be `Error` instances, so the
 * serializer normalizes strings, plain objects and `null` into a
 * predictable structure without throwing itself.
 */
function serializeError(err: unknown): {
    message?: string;
    name?: string;
    stack?: string;
} {
    if (err instanceof Error) {
        return {
            message: err.message,
            name: err.name,
            stack: err.stack,
        };
    }

    if (typeof err === "string") {
        return {message: err};
    }

    if (err && typeof err === "object") {
        const candidate = err as {message?: unknown; name?: unknown; stack?: unknown};

        return {
            message:
                typeof candidate.message === "string"
                    ? candidate.message
                    : undefined,
            name:
                typeof candidate.name === "string"
                    ? candidate.name
                    : undefined,
            stack:
                typeof candidate.stack === "string"
                    ? candidate.stack
                    : undefined,
        };
    }

    return {};
}

/**
 * Central error handler.
 *
 * Every failure path produces a stable machine-readable code. Stack
 * traces, SQL text, table names and constraint names never reach the
 * client; they are logged instead.
 */
export const errorHandler = (
    err: any,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void => {
    const requestId = getRequestId();

    // Handle Joi validation failures cleanly.
    if (err instanceof Joi.ValidationError) {
        res.status(422).json({
            code: errors.VALIDATION_FAILED.code,
            message: errors.VALIDATION_FAILED.message,
            errors: formatValidationErrors(err),
        });

        return;
    }

    // If it's our known custom AppError, use its status code.
    if (err instanceof AppError) {
        if (err.statusCode >= 500) {
            logger.error(
                {requestId, code: err.errorCode, message: err.message},
                "Application error",
            );
        }

        res.status(err.statusCode).json({
            code: err.errorCode || errors.SERVER_ERROR.code,
            message: err.message,
        });

        return;
    }

    /*
     * Translate PostgreSQL errors into stable 4xx/5xx responses.
     * Duplicate, foreign-key and not-null violations are client
     * errors, not server bugs.
     */
    const databaseError = mapDatabaseError(err);

    if (databaseError) {
        logger.warn(
            {
                requestId,
                code: databaseError.errorCode,
                pgCode: (err as {code?: string}).code,
            },
            "Database constraint error mapped to API error",
        );

        res.status(databaseError.statusCode).json({
            code: databaseError.errorCode,
            message: databaseError.message,
        });

        return;
    }

    // Fallback for unexpected system failures.
    logger.error(
        {
            requestId,
            err: serializeError(err),
        },
        "Unhandled Application Exception",
    );

    res.status(500).json({
        code: errors.SERVER_ERROR.code,
        message: errors.SERVER_ERROR.message,
    });
};
