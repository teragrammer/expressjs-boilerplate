import {describe, expect, it} from "vitest";
import {
    parseOptionalBoolean,
    parseOptionalEnum,
    parseOptionalId,
    parseOptionalSearch,
} from "./query-parser";

describe("query-parser", () => {
    describe("parseOptionalId", () => {
        it("returns undefined for an absent or empty value", () => {
            expect(parseOptionalId(undefined, "role_id")).toBeUndefined();
            expect(parseOptionalId(null, "role_id")).toBeUndefined();
            expect(parseOptionalId("", "role_id")).toBeUndefined();
        });

        it("parses a positive integer", () => {
            expect(parseOptionalId("10", "role_id")).toBe(10);
            expect(parseOptionalId(10, "role_id")).toBe(10);
        });

        it("rejects a non-positive or non-integer value", () => {
            expect(() => parseOptionalId("0", "role_id")).toThrow();
            expect(() => parseOptionalId("-1", "role_id")).toThrow();
            expect(() => parseOptionalId("1.5", "role_id")).toThrow();
            expect(() => parseOptionalId("abc", "role_id")).toThrow();
        });
    });

    describe("parseOptionalBoolean", () => {
        it("returns undefined for an absent or empty value", () => {
            expect(
                parseOptionalBoolean(undefined, "is_public"),
            ).toBeUndefined();
            expect(parseOptionalBoolean("", "is_public")).toBeUndefined();
        });

        it("parses the accepted boolean representations", () => {
            expect(parseOptionalBoolean("true", "is_public")).toBe(true);
            expect(parseOptionalBoolean("1", "is_public")).toBe(true);
            expect(parseOptionalBoolean("yes", "is_public")).toBe(true);
            expect(parseOptionalBoolean("on", "is_public")).toBe(true);
            expect(parseOptionalBoolean("false", "is_public")).toBe(false);
            expect(parseOptionalBoolean("0", "is_public")).toBe(false);
            expect(parseOptionalBoolean("no", "is_public")).toBe(false);
            expect(parseOptionalBoolean("off", "is_public")).toBe(false);
        });

        it("passes a boolean through", () => {
            expect(parseOptionalBoolean(true, "is_public")).toBe(true);
        });

        it("rejects an unrecognised value", () => {
            expect(() => parseOptionalBoolean("maybe", "is_public")).toThrow();
        });
    });

    describe("parseOptionalSearch", () => {
        it("returns undefined for an absent value", () => {
            expect(parseOptionalSearch(undefined)).toBeUndefined();
            expect(parseOptionalSearch(null)).toBeUndefined();
        });

        it("trims the value", () => {
            expect(parseOptionalSearch("  login  ")).toBe("login");
        });

        it("drops a blank value instead of filtering on it", () => {
            expect(parseOptionalSearch("   ")).toBeUndefined();
            expect(parseOptionalSearch("")).toBeUndefined();
        });

        it("rejects a non-string value", () => {
            expect(() => parseOptionalSearch(42)).toThrow();
        });

        it("rejects an over-long value", () => {
            expect(() => parseOptionalSearch("a".repeat(101))).toThrow();
        });
    });

    describe("parseOptionalEnum", () => {
        const allowed = ["integer", "string"] as const;

        it("returns undefined for an absent value", () => {
            expect(parseOptionalEnum(undefined, allowed, "type")).toBeUndefined();
            expect(parseOptionalEnum("", allowed, "type")).toBeUndefined();
        });

        it("returns the value when it is allowed", () => {
            expect(parseOptionalEnum("integer", allowed, "type")).toBe(
                "integer",
            );
        });

        it("rejects a value that is not allowed", () => {
            expect(() => parseOptionalEnum("blob", allowed, "type")).toThrow();
        });
    });
});
