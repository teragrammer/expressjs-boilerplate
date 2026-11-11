"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TOKEN_COOKIE = void 0;
exports.refreshTokenCookieOptions = refreshTokenCookieOptions;
exports.setRefreshTokenCookie = setRefreshTokenCookie;
exports.clearRefreshTokenCookie = clearRefreshTokenCookie;
exports.readRefreshTokenCookie = readRefreshTokenCookie;
const environment_1 = require("../../config/environment");
/**
 * Name of the cookie carrying the opaque refresh token.
 *
 * The cookie is scoped to the auth routes so it is never attached to
 * ordinary API calls.
 */
exports.REFRESH_TOKEN_COOKIE = "refresh_token";
/**
 * Cookie attributes.
 *
 * `HttpOnly` keeps the token out of reach of scripts, `SameSite=Strict`
 * prevents it from riding along on cross-site requests, and `Secure` is
 * required in production.
 */
function refreshTokenCookieOptions(maxAgeMs) {
    return {
        httpOnly: true,
        secure: environment_1.__ENV.NODE_ENV === "production",
        sameSite: "strict",
        path: "/api/v1/auth",
        maxAge: maxAgeMs,
    };
}
/**
 * Sets the refresh token cookie on a response.
 */
function setRefreshTokenCookie(res, refreshToken, maxAgeMs) {
    res.cookie(exports.REFRESH_TOKEN_COOKIE, refreshToken, refreshTokenCookieOptions(maxAgeMs));
}
/**
 * Clears the refresh token cookie.
 */
function clearRefreshTokenCookie(res) {
    res.clearCookie(exports.REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions(0));
}
/**
 * Reads the refresh token from the request cookie.
 *
 * The cookie header is parsed directly so the application does not need
 * an extra middleware dependency.
 */
function readRefreshTokenCookie(req) {
    const header = req.headers.cookie;
    if (!header) {
        return undefined;
    }
    for (const part of header.split(";")) {
        const [rawName, ...rawValue] = part.trim().split("=");
        if (rawName === exports.REFRESH_TOKEN_COOKIE) {
            return decodeURIComponent(rawValue.join("="));
        }
    }
    return undefined;
}
