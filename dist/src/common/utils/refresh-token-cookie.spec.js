"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const refresh_token_cookie_1 = require("./refresh-token-cookie");
(0, vitest_1.describe)("refresh-token-cookie", () => {
    (0, vitest_1.describe)("refreshTokenCookieOptions()", () => {
        (0, vitest_1.it)("marks the cookie as HttpOnly and SameSite=Strict", () => {
            const options = (0, refresh_token_cookie_1.refreshTokenCookieOptions)(1000);
            (0, vitest_1.expect)(options.httpOnly).toBe(true);
            (0, vitest_1.expect)(options.sameSite).toBe("strict");
            (0, vitest_1.expect)(options.path).toBe("/api/v1/auth");
            (0, vitest_1.expect)(options.maxAge).toBe(1000);
        });
    });
    (0, vitest_1.describe)("setRefreshTokenCookie()", () => {
        (0, vitest_1.it)("writes the token with the hardened attributes", () => {
            const res = { cookie: vitest_1.vi.fn() };
            (0, refresh_token_cookie_1.setRefreshTokenCookie)(res, "token-value", 5000);
            (0, vitest_1.expect)(res.cookie).toHaveBeenCalledWith(refresh_token_cookie_1.REFRESH_TOKEN_COOKIE, "token-value", vitest_1.expect.objectContaining({ httpOnly: true }));
        });
    });
    (0, vitest_1.describe)("clearRefreshTokenCookie()", () => {
        (0, vitest_1.it)("clears the cookie", () => {
            const res = { clearCookie: vitest_1.vi.fn() };
            (0, refresh_token_cookie_1.clearRefreshTokenCookie)(res);
            (0, vitest_1.expect)(res.clearCookie).toHaveBeenCalledWith(refresh_token_cookie_1.REFRESH_TOKEN_COOKIE, vitest_1.expect.objectContaining({ httpOnly: true }));
        });
    });
    (0, vitest_1.describe)("readRefreshTokenCookie()", () => {
        const requestWith = (cookie) => ({ headers: cookie ? { cookie } : {} });
        (0, vitest_1.it)("returns undefined when there is no cookie header", () => {
            (0, vitest_1.expect)((0, refresh_token_cookie_1.readRefreshTokenCookie)(requestWith())).toBeUndefined();
        });
        (0, vitest_1.it)("returns undefined when the cookie is absent", () => {
            (0, vitest_1.expect)((0, refresh_token_cookie_1.readRefreshTokenCookie)(requestWith("other=value; another=thing"))).toBeUndefined();
        });
        (0, vitest_1.it)("reads the refresh token", () => {
            (0, vitest_1.expect)((0, refresh_token_cookie_1.readRefreshTokenCookie)(requestWith(`other=1; ${refresh_token_cookie_1.REFRESH_TOKEN_COOKIE}=abc123; x=2`))).toBe("abc123");
        });
        (0, vitest_1.it)("decodes a URL-encoded value", () => {
            (0, vitest_1.expect)((0, refresh_token_cookie_1.readRefreshTokenCookie)(requestWith(`${refresh_token_cookie_1.REFRESH_TOKEN_COOKIE}=a%2Bb`))).toBe("a+b");
        });
        (0, vitest_1.it)("handles a value that contains an equals sign", () => {
            (0, vitest_1.expect)((0, refresh_token_cookie_1.readRefreshTokenCookie)(requestWith(`${refresh_token_cookie_1.REFRESH_TOKEN_COOKIE}=a=b=c`))).toBe("a=b=c");
        });
    });
});
