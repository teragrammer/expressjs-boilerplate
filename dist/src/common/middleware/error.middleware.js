"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = void 0;
const joi_1 = __importDefault(require("joi"));
const logger_1 = require("../../config/logger");
const messages_1 = __importDefault(require("../utils/messages"));
const errors_1 = require("../utils/errors");
const db_error_mapper_1 = require("../utils/db-error.mapper");
const request_context_1 = require("../context/request-context");
/**
 * Formats a Joi validation failure into the API error envelope.
 */
function formatValidationErrors(err) {
    return err.details.map((detail) => {
        var _a;
        const field = String((_a = detail.path[0]) !== null && _a !== void 0 ? _a : "");
        const formattedField = field
            .split("_")
            .map((word) => {
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
function serializeError(err) {
    if (err instanceof Error) {
        return {
            message: err.message,
            name: err.name,
            stack: err.stack,
        };
    }
    if (typeof err === "string") {
        return { message: err };
    }
    if (err && typeof err === "object") {
        const candidate = err;
        return {
            message: typeof candidate.message === "string"
                ? candidate.message
                : undefined,
            name: typeof candidate.name === "string"
                ? candidate.name
                : undefined,
            stack: typeof candidate.stack === "string"
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
const errorHandler = (err, _req, res, _next) => {
    const requestId = (0, request_context_1.getRequestId)();
    // Handle Joi validation failures cleanly.
    if (err instanceof joi_1.default.ValidationError) {
        res.status(422).json({
            code: messages_1.default.VALIDATION_FAILED.code,
            message: messages_1.default.VALIDATION_FAILED.message,
            errors: formatValidationErrors(err),
        });
        return;
    }
    // If it's our known custom AppError, use its status code.
    if (err instanceof errors_1.AppError) {
        if (err.statusCode >= 500) {
            logger_1.logger.error({ requestId, code: err.errorCode, message: err.message }, "Application error");
        }
        res.status(err.statusCode).json({
            code: err.errorCode || messages_1.default.SERVER_ERROR.code,
            message: err.message,
        });
        return;
    }
    /*
     * Translate PostgreSQL errors into stable 4xx/5xx responses.
     * Duplicate, foreign-key and not-null violations are client
     * errors, not server bugs.
     */
    const databaseError = (0, db_error_mapper_1.mapDatabaseError)(err);
    if (databaseError) {
        logger_1.logger.warn({
            requestId,
            code: databaseError.errorCode,
            pgCode: err.code,
        }, "Database constraint error mapped to API error");
        res.status(databaseError.statusCode).json({
            code: databaseError.errorCode,
            message: databaseError.message,
        });
        return;
    }
    // Fallback for unexpected system failures.
    logger_1.logger.error({
        requestId,
        err: serializeError(err),
    }, "Unhandled Application Exception");
    res.status(500).json({
        code: messages_1.default.SERVER_ERROR.code,
        message: messages_1.default.SERVER_ERROR.message,
    });
};
exports.errorHandler = errorHandler;
