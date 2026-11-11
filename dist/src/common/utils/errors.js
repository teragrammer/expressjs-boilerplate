"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppError = void 0;
/**
 * A reusable custom error class for clean, scalable Express error handling.
 * Allows throwing errors with custom HTTP status codes and API error codes.
 */
class AppError extends Error {
    constructor(errMeta, customMessage, 
    /**
     * Overrides the machine-readable code of the error.
     *
     * Used when the same status is reported under several codes,
     * for example the rate limiter's per-bucket codes.
     */
    code) {
        super(customMessage !== null && customMessage !== void 0 ? customMessage : errMeta.message);
        this.errorCode = code !== null && code !== void 0 ? code : errMeta.code;
        this.statusCode = errMeta.status;
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
