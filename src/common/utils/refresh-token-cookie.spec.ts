import {Request, Response} from "express";
import {describe, expect, it, vi} from "vitest";
import {
    clearRefreshTokenCookie,
    readRefreshTokenCookie,
    REFRESH_TOKEN_COOKIE,
    refreshTokenCookieOptions,
    setRefreshTokenCookie,
} from "./refresh-token-cookie";

describe("refresh-token-cookie", () => {
    describe("refreshTokenCookieOptions()", () => {
        it("marks the cookie as HttpOnly and SameSite=Strict", () => {
            const options = refreshTokenCookieOptions(1000);

            expect(options.httpOnly).toBe(true);
            expect(options.sameSite).toBe("strict");
            expect(options.path).toBe("/api/v1/auth");
            expect(options.maxAge).toBe(1000);
        });
    });

    describe("setRefreshTokenCookie()", () => {
        it("writes the token with the hardened attributes", () => {
            const res = {cookie: vi.fn()} as unknown as Response;

            setRefreshTokenCookie(res, "token-value", 5000);

            expect(res.cookie).toHaveBeenCalledWith(
                REFRESH_TOKEN_COOKIE,
                "token-value",
                expect.objectContaining({httpOnly: true}),
            );
        });
    });

    describe("clearRefreshTokenCookie()", () => {
        it("clears the cookie", () => {
            const res = {clearCookie: vi.fn()} as unknown as Response;

            clearRefreshTokenCookie(res);

            expect(res.clearCookie).toHaveBeenCalledWith(
                REFRESH_TOKEN_COOKIE,
                expect.objectContaining({httpOnly: true}),
            );
        });
    });

    describe("readRefreshTokenCookie()", () => {
        const requestWith = (cookie?: string) =>
            ({headers: cookie ? {cookie} : {}}) as Request;

        it("returns undefined when there is no cookie header", () => {
            expect(readRefreshTokenCookie(requestWith())).toBeUndefined();
        });

        it("returns undefined when the cookie is absent", () => {
            expect(
                readRefreshTokenCookie(
                    requestWith("other=value; another=thing"),
                ),
            ).toBeUndefined();
        });

        it("reads the refresh token", () => {
            expect(
                readRefreshTokenCookie(
                    requestWith(`other=1; ${REFRESH_TOKEN_COOKIE}=abc123; x=2`),
                ),
            ).toBe("abc123");
        });

        it("decodes a URL-encoded value", () => {
            expect(
                readRefreshTokenCookie(
                    requestWith(`${REFRESH_TOKEN_COOKIE}=a%2Bb`),
                ),
            ).toBe("a+b");
        });

        it("handles a value that contains an equals sign", () => {
            expect(
                readRefreshTokenCookie(
                    requestWith(`${REFRESH_TOKEN_COOKIE}=a=b=c`),
                ),
            ).toBe("a=b=c");
        });
    });
});
