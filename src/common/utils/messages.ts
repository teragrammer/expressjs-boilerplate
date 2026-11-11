// src/utils/messages.ts
export const Messages = {
    VALIDATION_FAILED: {
        code: "VALIDATION_FAILED",
        status: 422,
        message: "Validation errors were encountered during the process",
    },
    INVALID_REQUEST: {
        code: "INVALID_REQUEST",
        status: 400,
        message: "The request is invalid or malformed",
    },
    INVALID_PATH_PARAM: {
        code: "INVALID_PATH_PARAM",
        status: 400,
        message: "One or more path parameters are invalid",
    },
    DUPLICATE_DATA: {
        code: "DUPLICATE_DATA",
        status: 409,
        message: "The data you've selected is already assigned",
    },
    DATA_NOT_FOUND: {
        code: "DATA_NOT_FOUND",
        status: 404,
        message: "The information you are looking for is not available",
    },
    USER_NOT_FOUND: {
        code: "USER_NOT_FOUND",
        status: 404,
        message: "The requested user could not be found",
    },
    SERVER_ERROR: {
        code: "SERVER_ERROR",
        status: 500,
        message: "Whoops something went wrong",
    },
    UNAUTHORIZED: {
        code: "UNAUTHORIZED",
        status: 401,
        message: "You are not authorized to access this resource",
    },
    SESSION_EXPIRED: {
        code: "SESSION_EXPIRED",
        status: 401,
        message: "Your session has expired, please log in again",
    },
    INVALID_TOKEN: {
        code: "INVALID_TOKEN",
        status: 401,
        message: "The provided token is invalid",
    },
    EXPIRED_TOKEN: {
        code: "EXPIRED_TOKEN",
        status: 401,
        message: "The provided token has expired",
    },
    INVALID_AUTH_TOKEN: {
        code: "INVALID_AUTH_TOKEN",
        status: 401,
        message: "The provided authentication token is invalid or missing",
    },
    EXPIRED_AUTH_TOKEN: {
        code: "EXPIRED_AUTH_TOKEN",
        status: 401,
        message: "The token used for authentication is no longer valid",
    },
    INACTIVE_ACCOUNT: {
        code: "INACTIVE_ACCOUNT",
        status: 403,
        message: "The account status is inactive and requires activation",
    },
    INCORRECT_PASS_SETUP: {
        code: "INCORRECT_PASS_SETUP",
        status: 400,
        message: "Password creation failed due to incorrect setup",
    },
    TOO_MANY_ATTEMPTS: {
        code: "TOO_MANY_ATTEMPTS",
        status: 429,
        message: "The system has detected too many incorrect login attempts",
    },
    LOCKED_ACCOUNT: {
        code: "LOCKED_ACCOUNT",
        status: 403,
        message: "Your account has been temporarily locked due to multiple login attempts",
    },
    CREDENTIAL_DO_NOT_MATCH: {
        code: "CREDENTIAL_DO_NOT_MATCH",
        status: 401,
        message: "The credentials provided do not match our records",
    },
    CONTENT_READ_ONLY: {
        code: "CONTENT_READ_ONLY",
        status: 403,
        message: "The content is read-only and cannot be altered",
    },
    FORBIDDEN: {
        code: "FORBIDDEN",
        status: 403,
        message: "Access to this resource is forbidden",
    },
    NO_PERMISSION: {
        code: "NO_PERMISSION",
        status: 403,
        message: "You do not have the required permissions to access this content",
    },
    INVALID_CODE: {
        code: "INVALID_CODE",
        status: 400,
        message: "The provided code is invalid",
    },
    INCOMPLETE_OTP: {
        code: "INCOMPLETE_OTP",
        status: 403,
        message: "You must complete OTP verification to access this section",
    },
    RESEND_OTP_NOT_POSSIBLE: {
        code: "RESEND_OTP_NOT_POSSIBLE",
        status: 400,
        message: "Resending the OTP is currently not possible",
    },
    UN_CONFIGURED_EMAIL: {
        code: "UN_CONFIGURED_EMAIL",
        status: 500,
        message: "There is an issue with your email configuration",
    },
    UNABLE_TO_SEND_EMAIL: {
        code: "UNABLE_TO_SEND_EMAIL",
        status: 500,
        message: "There was an issue sending the email",
    },
    OTP_NOT_NEEDED: {
        code: "OTP_NOT_NEEDED",
        status: 400,
        message: "No OTP is necessary for this process",
    },
    UN_CONFIGURED_EXPIRATION: {
        code: "UN_CONFIGURED_EXPIRATION",
        status: 500,
        message: "There is an issue with the expiration configuration",
    },
    RESOURCE_EXPIRED: {
        code: "RESOURCE_EXPIRED",
        status: 400,
        message: "The data is no longer valid due to expiration",
    },
    OTP_NO_MATCH: {
        code: "OTP_NO_MATCH",
        status: 400,
        message: "The OTP provided does not match our records",
    },
    TRY_RESEND: {
        code: "TRY_RESEND",
        status: 429,
        message: "Please try to resend again later",
    },
    RECOVERY_COMPLETION_FAILED: {
        code: "RECOVERY_COMPLETION_FAILED",
        status: 500,
        message: "Failed to complete the recovery process. Please try again later",
    },
    INVALID_RECOVERY_TYPE: {
        code: "INVALID_RECOVERY_TYPE",
        status: 400,
        message: "The specified recovery type is invalid or unsupported",
    },
    EXCEED_RECOVERY: {
        code: "EXCEED_RECOVERY",
        status: 429,
        message: "Recovery tries exceeded maximum limit",
    },
    RECOVERY_CODE_INVALID: {
        code: "RECOVERY_CODE_INVALID",
        status: 400,
        message: "The provided recovery code is invalid",
    },
    UPDATE_FAILED: {
        code: "UPDATE_FAILED",
        status: 500,
        message: "Unable to save changes. Please try again later",
    },
    DELETE_FAILED: {
        code: "DELETE_FAILED",
        status: 500,
        message: "Unable to delete the requested resource at this time. Please try again shortly",
    },
    RATE_LIMIT_EXCEEDED: {
        code: "RATE_LIMIT_EXCEEDED",
        status: 429,
        message: "Too many requests, please try again later",
    },
} as const;

/**
 * Deep freezes an object to ensure runtime immutability for nested properties.
 */
function deepFreeze<T extends object>(obj: T): T {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach((prop) => {
        const value = (obj as any)[prop];
        if (value && (typeof value === "object" || typeof value === "function") && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    });
    return obj;
}

// Deep freeze the dictionary
deepFreeze(Messages);

export type MessageKey = keyof typeof Messages;
export default Messages;