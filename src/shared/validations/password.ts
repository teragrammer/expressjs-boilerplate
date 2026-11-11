// src/shared/validations/password.ts
import Joi from "./joi";

/**
 * Password policy.
 *
 * The rules follow NIST SP 800-63B-4: length matters more than
 * composition, spaces and Unicode are allowed, and the user is not
 * forced into a predictable pattern. The maximum is 64 characters;
 * longer secrets are folded into a digest before hashing, so the
 * bcrypt 72-byte limit is handled by `SecurityUtil`.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 64;

/**
 * The shared password schema.
 *
 * `.allow("")` is deliberately absent: an empty password is never
 * valid.
 */
export const passwordSchema = Joi.string()
    .min(PASSWORD_MIN_LENGTH)
    .max(PASSWORD_MAX_LENGTH)
    .required()
    .messages({
        "string.min": `The password must be at least ${PASSWORD_MIN_LENGTH} characters long.`,
        "string.max": `The password must be at most ${PASSWORD_MAX_LENGTH} characters long.`,
        "any.required": "The password is required.",
    });

/**
 * The password schema for a confirmed change, where the current
 * password is also required.
 */
export const currentPasswordSchema = Joi.string()
    .min(1)
    .max(PASSWORD_MAX_LENGTH)
    .required()
    .messages({
        "any.required": "The current password is required.",
    });
