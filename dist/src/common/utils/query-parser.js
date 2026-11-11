"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseOptionalId = parseOptionalId;
exports.parseOptionalBoolean = parseOptionalBoolean;
exports.parseOptionalSearch = parseOptionalSearch;
exports.parseOptionalEnum = parseOptionalEnum;
// src/common/utils/query-parser.ts
/**
 * Shared query-string parsing for browse endpoints.
 *
 * The sanitizer helpers return `undefined` when a parameter is absent
 * so a missing filter is never confused with an explicit `0` or
 * `false`. Invalid values are rejected with a 400 so a typo cannot
 * silently widen a result set.
 */
const errors_1 = require("./errors");
const messages_1 = __importDefault(require("./messages"));
/**
 * Parses an optional integer query parameter.
 *
 * @returns `undefined` when the parameter is absent or empty.
 * @throws when the value is not a positive integer.
 */
function parseOptionalId(value, field) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new errors_1.AppError(messages_1.default.INVALID_REQUEST, `'${field}' must be a positive integer.`);
    }
    return parsed;
}
/**
 * Parses an optional boolean query parameter.
 *
 * Accepts `true`/`false`, `1`/`0` and `yes`/`no`.
 *
 * @returns `undefined` when the parameter is absent or empty.
 * @throws when the value is not a recognised boolean.
 */
function parseOptionalBoolean(value, field) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    if (typeof value === "boolean") {
        return value;
    }
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
        return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
        return false;
    }
    throw new errors_1.AppError(messages_1.default.INVALID_REQUEST, `'${field}' must be a boolean value.`);
}
/**
 * Parses an optional search term.
 *
 * The value is trimmed and an empty result becomes `undefined`, so a
 * blank search never becomes a `LIKE '%%'` predicate.
 */
function parseOptionalSearch(value, field = "search") {
    if (value === undefined || value === null) {
        return undefined;
    }
    if (typeof value !== "string") {
        throw new errors_1.AppError(messages_1.default.INVALID_REQUEST, `'${field}' must be a string.`);
    }
    const trimmed = value.trim();
    if (trimmed === "") {
        return undefined;
    }
    if (trimmed.length > 100) {
        throw new errors_1.AppError(messages_1.default.INVALID_REQUEST, `'${field}' must be at most 100 characters.`);
    }
    return trimmed;
}
/**
 * Parses an optional enum-like string.
 */
function parseOptionalEnum(value, allowed, field) {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }
    const normalized = String(value).trim();
    if (!allowed.includes(normalized)) {
        throw new errors_1.AppError(messages_1.default.INVALID_REQUEST, `'${field}' must be one of: ${allowed.join(", ")}.`);
    }
    return normalized;
}
