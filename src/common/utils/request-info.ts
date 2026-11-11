// src/common/utils/request-info.ts
import {Request} from "express";

/**
 * Reads the User-Agent header.
 *
 * `req.get()` is not available on every request-like object (unit
 * tests use partial mocks), so the raw header is read directly.
 */
export function getUserAgent(req: Request): string | undefined {
    const header = req.headers?.["user-agent"];

    if (Array.isArray(header)) {
        return header[0];
    }

    return typeof header === "string" ? header : undefined;
}

/**
 * Reads the client IP.
 */
export function getClientIp(req: Request): string | null {
    return req.ip ?? req.socket?.remoteAddress ?? null;
}

/**
 * Reads the parsed user-agent information, when the middleware ran.
 */
export function getUserAgentInfo(req: Request): {
    browser: string | null;
    os: string | null;
} {
    return {
        browser: req.useragent?.browser ?? null,
        os: req.useragent?.os ?? null,
    };
}
