// src/common/utils/errors.ts
import Messages, {MessageKey} from "./messages";

/**
 * A reusable custom error class for clean, scalable Express error handling.
 * Allows throwing errors with custom HTTP status codes and API error codes.
 */
export class AppError extends Error {
    public errorCode: string;
    public statusCode: number;

    constructor(
        errMeta: typeof Messages[MessageKey],
        customMessage?: string,
        /**
         * Overrides the machine-readable code of the error.
         *
         * Used when the same status is reported under several codes,
         * for example the rate limiter's per-bucket codes.
         */
        code?: string,
    ) {
        super(customMessage ?? errMeta.message);
        this.errorCode = code ?? errMeta.code;
        this.statusCode = errMeta.status;

        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}