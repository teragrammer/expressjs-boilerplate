// src/common/utils/query-parser.ts
/**
 * Shared query-string parsing for browse endpoints.
 *
 * The sanitizer helpers return `undefined` when a parameter is absent
 * so a missing filter is never confused with an explicit `0` or
 * `false`. Invalid values are rejected with a 400 so a typo cannot
 * silently widen a result set.
 */
import {AppError} from "./errors";
import Messages from "./messages";

/**
 * Parses an optional integer query parameter.
 *
 * @returns `undefined` when the parameter is absent or empty.
 * @throws when the value is not a positive integer.
 */
export function parseOptionalId(
    value: unknown,
    field: string,
): number | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new AppError(
            Messages.INVALID_REQUEST,
            `'${field}' must be a positive integer.`,
        );
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
export function parseOptionalBoolean(
    value: unknown,
    field: string,
): boolean | undefined {
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

    throw new AppError(
        Messages.INVALID_REQUEST,
        `'${field}' must be a boolean value.`,
    );
}

/**
 * Parses an optional search term.
 *
 * The value is trimmed and an empty result becomes `undefined`, so a
 * blank search never becomes a `LIKE '%%'` predicate.
 */
export function parseOptionalSearch(
    value: unknown,
    field = "search",
): string | undefined {
    if (value === undefined || value === null) {
        return undefined;
    }

    if (typeof value !== "string") {
        throw new AppError(
            Messages.INVALID_REQUEST,
            `'${field}' must be a string.`,
        );
    }

    const trimmed = value.trim();

    if (trimmed === "") {
        return undefined;
    }

    if (trimmed.length > 100) {
        throw new AppError(
            Messages.INVALID_REQUEST,
            `'${field}' must be at most 100 characters.`,
        );
    }

    return trimmed;
}

/**
 * Parses an optional enum-like string.
 */
export function parseOptionalEnum<T extends string>(
    value: unknown,
    allowed: readonly T[],
    field: string,
): T | undefined {
    if (value === undefined || value === null || value === "") {
        return undefined;
    }

    const normalized = String(value).trim();

    if (!(allowed as readonly string[]).includes(normalized)) {
        throw new AppError(
            Messages.INVALID_REQUEST,
            `'${field}' must be one of: ${allowed.join(", ")}.`,
        );
    }

    return normalized as T;
}
