// src/common/middleware/request.middleware.ts

import {NextFunction, Request, Response} from "express";
import * as xss from "xss";
import {SanitizerHelper} from "../../@types/express";

/**
 * Fields that are opaque secrets.
 *
 * They must reach validation and bcrypt exactly as supplied: trimming
 * or HTML-stripping a password changes the secret the user chose (and
 * can silently reduce its entropy).
 */
const OPAQUE_FIELDS = new Set([
    "password",
    "current_password",
    "new_password",
]);

const sanitizeString = (value: unknown): any => {
    if (typeof value !== "string") {return value;}

    const cleaned = xss.filterXSS(value, {
        whiteList: {},
        stripIgnoreTag: true,
    }).trim();

    return cleaned === "" ? null : cleaned;
};

const sanitizeField = (key: string, value: unknown): any => {
    if (OPAQUE_FIELDS.has(key)) {
        return value;
    }

    return sanitizeString(value);
};

const convertToNumber = (
    value: unknown,
    defaultValue = 0
): number => {
    if (typeof value === "number" && !isNaN(value)) {
        return value;
    }

    if (typeof value === "string" && value.trim() !== "") {
        const parsed = Number(value);

        return !isNaN(parsed)
            ? parsed
            : defaultValue;
    }

    return defaultValue;
};

const createSanitizer = (
    source: Record<string, any>
): SanitizerHelper => ({
    get: <T = any>(
        key: string,
        defaults?: T
    ): T => {
        return key in source
            ? sanitizeField(key, source[key])
            : (defaults as T);
    },

    only: <T extends Record<string, any> = Record<string, any>>(
        keys: string[],
        defaults?: Partial<T>
    ): T => {
        if (!source || !Array.isArray(keys)) {
            return {} as T;
        }

        return keys.reduce((result, key) => {
            if (key in source) {
                result[key] = sanitizeField(key, source[key]);
            } else if (defaults && key in defaults) {
                result[key] = defaults[key];
            }

            return result;
        }, {} as Record<string, any>) as T;
    },

    numeric: (
        key: string,
        defaults = 0
    ): number => {
        return key in source
            ? convertToNumber(source[key], defaults)
            : defaults;
    }
});

const requestHandler = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {

    req.sanitize = {
        body: createSanitizer(req.body || {}),
        query: createSanitizer(req.query || {}),
        data: {},
    };

    /*
     * ---------------------------------------------------------
     * Traditional pagination
     * ---------------------------------------------------------
     *
     * Used by existing endpoints.
     */
    const rawPerPage = req.query.per_page;
    const rawPage = req.query.page;

    const perPage = convertToNumber(rawPerPage, 10);
    const page = convertToNumber(rawPage, 1);

    const validatedPage = Math.max(1, Math.floor(page));
    const validatedPerPage = Math.min(
        100,
        Math.max(1, Math.floor(perPage))
    );

    req.pagination = {
        page: validatedPage,
        offset: (validatedPage - 1) * validatedPerPage,
        perPage: validatedPerPage,
    };

    /*
     * ---------------------------------------------------------
     * Cursor pagination
     * ---------------------------------------------------------
     *
     * Used by high-volume endpoints such as users.
     */
    const rawCursor = req.query.cursor;

    const cursor = rawCursor !== undefined
        ? convertToNumber(rawCursor, 0)
        : undefined;

    req.cursorPagination = {
        cursor: cursor && cursor > 0
            ? Math.floor(cursor)
            : undefined,
        perPage: validatedPerPage,
    };

    next();
};

export default requestHandler;
