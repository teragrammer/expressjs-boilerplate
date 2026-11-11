// src/common/utils/refresh-token-cookie.ts
import {Request, Response} from "express";
import {__ENV} from "../../config/environment";

/**
 * Name of the cookie carrying the opaque refresh token.
 *
 * The cookie is scoped to the auth routes so it is never attached to
 * ordinary API calls.
 */
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/**
 * Cookie attributes.
 *
 * `HttpOnly` keeps the token out of reach of scripts, `SameSite=Strict`
 * prevents it from riding along on cross-site requests, and `Secure` is
 * required in production.
 */
export function refreshTokenCookieOptions(maxAgeMs: number) {
    return {
        httpOnly: true,
        secure: __ENV.NODE_ENV === "production",
        sameSite: "strict" as const,
        path: "/api/v1/auth",
        maxAge: maxAgeMs,
    };
}

/**
 * Sets the refresh token cookie on a response.
 */
export function setRefreshTokenCookie(
    res: Response,
    refreshToken: string,
    maxAgeMs: number,
): void {
    res.cookie(
        REFRESH_TOKEN_COOKIE,
        refreshToken,
        refreshTokenCookieOptions(maxAgeMs),
    );
}

/**
 * Clears the refresh token cookie.
 */
export function clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(
        REFRESH_TOKEN_COOKIE,
        refreshTokenCookieOptions(0),
    );
}

/**
 * Reads the refresh token from the request cookie.
 *
 * The cookie header is parsed directly so the application does not need
 * an extra middleware dependency.
 */
export function readRefreshTokenCookie(req: Request): string | undefined {
    const header = req.headers.cookie;

    if (!header) {
        return undefined;
    }

    for (const part of header.split(";")) {
        const [rawName, ...rawValue] = part.trim().split("=");

        if (rawName === REFRESH_TOKEN_COOKIE) {
            return decodeURIComponent(rawValue.join("="));
        }
    }

    return undefined;
}
