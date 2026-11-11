"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
/**
 * A reusable custom error class for clean, scalable Express error handling.
 * Allows throwing errors with custom HTTP status codes and API error codes.
 */
class AppError extends Error {
    constructor(errMeta, customMessage) {
        super(customMessage !== null && customMessage !== void 0 ? customMessage : errMeta.message);
        this.errorCode = errMeta.code;
        this.statusCode = errMeta.status;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
