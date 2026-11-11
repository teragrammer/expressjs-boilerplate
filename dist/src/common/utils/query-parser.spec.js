"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const query_parser_1 = require("./query-parser");
(0, vitest_1.describe)("query-parser", () => {
    (0, vitest_1.describe)("parseOptionalId", () => {
        (0, vitest_1.it)("returns undefined for an absent or empty value", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalId)(undefined, "role_id")).toBeUndefined();
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalId)(null, "role_id")).toBeUndefined();
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalId)("", "role_id")).toBeUndefined();
        });
        (0, vitest_1.it)("parses a positive integer", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalId)("10", "role_id")).toBe(10);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalId)(10, "role_id")).toBe(10);
        });
        (0, vitest_1.it)("rejects a non-positive or non-integer value", () => {
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalId)("0", "role_id")).toThrow();
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalId)("-1", "role_id")).toThrow();
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalId)("1.5", "role_id")).toThrow();
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalId)("abc", "role_id")).toThrow();
        });
    });
    (0, vitest_1.describe)("parseOptionalBoolean", () => {
        (0, vitest_1.it)("returns undefined for an absent or empty value", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)(undefined, "is_public")).toBeUndefined();
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("", "is_public")).toBeUndefined();
        });
        (0, vitest_1.it)("parses the accepted boolean representations", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("true", "is_public")).toBe(true);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("1", "is_public")).toBe(true);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("yes", "is_public")).toBe(true);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("on", "is_public")).toBe(true);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("false", "is_public")).toBe(false);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("0", "is_public")).toBe(false);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("no", "is_public")).toBe(false);
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)("off", "is_public")).toBe(false);
        });
        (0, vitest_1.it)("passes a boolean through", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalBoolean)(true, "is_public")).toBe(true);
        });
        (0, vitest_1.it)("rejects an unrecognised value", () => {
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalBoolean)("maybe", "is_public")).toThrow();
        });
    });
    (0, vitest_1.describe)("parseOptionalSearch", () => {
        (0, vitest_1.it)("returns undefined for an absent value", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalSearch)(undefined)).toBeUndefined();
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalSearch)(null)).toBeUndefined();
        });
        (0, vitest_1.it)("trims the value", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalSearch)("  login  ")).toBe("login");
        });
        (0, vitest_1.it)("drops a blank value instead of filtering on it", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalSearch)("   ")).toBeUndefined();
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalSearch)("")).toBeUndefined();
        });
        (0, vitest_1.it)("rejects a non-string value", () => {
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalSearch)(42)).toThrow();
        });
        (0, vitest_1.it)("rejects an over-long value", () => {
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalSearch)("a".repeat(101))).toThrow();
        });
    });
    (0, vitest_1.describe)("parseOptionalEnum", () => {
        const allowed = ["integer", "string"];
        (0, vitest_1.it)("returns undefined for an absent value", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalEnum)(undefined, allowed, "type")).toBeUndefined();
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalEnum)("", allowed, "type")).toBeUndefined();
        });
        (0, vitest_1.it)("returns the value when it is allowed", () => {
            (0, vitest_1.expect)((0, query_parser_1.parseOptionalEnum)("integer", allowed, "type")).toBe("integer");
        });
        (0, vitest_1.it)("rejects a value that is not allowed", () => {
            (0, vitest_1.expect)(() => (0, query_parser_1.parseOptionalEnum)("blob", allowed, "type")).toThrow();
        });
    });
});
