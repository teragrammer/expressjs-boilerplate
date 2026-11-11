"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentPasswordSchema = exports.passwordSchema = exports.PASSWORD_MAX_LENGTH = exports.PASSWORD_MIN_LENGTH = void 0;
// src/shared/validations/password.ts
const joi_1 = __importDefault(require("./joi"));
/**
 * Password policy.
 *
 * The rules follow NIST SP 800-63B-4: length matters more than
 * composition, spaces and Unicode are allowed, and the user is not
 * forced into a predictable pattern. The maximum is 64 characters;
 * longer secrets are folded into a digest before hashing, so the
 * bcrypt 72-byte limit is handled by `SecurityUtil`.
 */
exports.PASSWORD_MIN_LENGTH = 12;
exports.PASSWORD_MAX_LENGTH = 64;
/**
 * The shared password schema.
 *
 * `.allow("")` is deliberately absent: an empty password is never
 * valid.
 */
exports.passwordSchema = joi_1.default.string()
    .min(exports.PASSWORD_MIN_LENGTH)
    .max(exports.PASSWORD_MAX_LENGTH)
    .required()
    .messages({
    "string.min": `The password must be at least ${exports.PASSWORD_MIN_LENGTH} characters long.`,
    "string.max": `The password must be at most ${exports.PASSWORD_MAX_LENGTH} characters long.`,
    "any.required": "The password is required.",
});
/**
 * The password schema for a confirmed change, where the current
 * password is also required.
 */
exports.currentPasswordSchema = joi_1.default.string()
    .min(1)
    .max(exports.PASSWORD_MAX_LENGTH)
    .required()
    .messages({
    "any.required": "The current password is required.",
});
