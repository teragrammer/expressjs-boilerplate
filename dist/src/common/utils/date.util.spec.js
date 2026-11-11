"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// src/common/utils/date.util.spec.ts
const vitest_1 = require("vitest");
const date_util_1 = require("./date.util");
(0, vitest_1.describe)("DateUtil", () => {
    const dateUtil = new date_util_1.DateUtil();
    const fixedNow = new Date("2026-06-15T12:00:00.000Z");
    (0, vitest_1.describe)("sql", () => {
        (0, vitest_1.it)("should format a Date object into a full SQL timestamp using default now fallback", () => {
            const date = new Date("2026-01-01T15:30:45.000Z");
            const result = dateUtil.sql(date, false, fixedNow);
            (0, vitest_1.expect)(result).toBe("2026-01-01 15:30:45");
        });
        (0, vitest_1.it)("should format a date string into a date-only SQL format when dateOnly is true", () => {
            const dateStr = "2026-05-10T08:00:00.000Z";
            const result = dateUtil.sql(dateStr, true, fixedNow);
            (0, vitest_1.expect)(result).toBe("2026-05-10");
        });
        (0, vitest_1.it)("should use the provided now fallback when date is null or undefined", () => {
            const result = dateUtil.sql(null, false, fixedNow);
            (0, vitest_1.expect)(result).toBe("2026-06-15 12:00:00");
            const undefinedResult = dateUtil.sql(undefined, false, fixedNow);
            (0, vitest_1.expect)(undefinedResult).toBe("2026-06-15 12:00:00");
        });
    });
    (0, vitest_1.describe)("expiredAt", () => {
        (0, vitest_1.it)("should calculate expiration correctly with numeric amount and string unit", () => {
            const baseDate = new Date("2026-06-15T12:00:00.000Z");
            const result = dateUtil.expiredAt(2, "days", baseDate, false, fixedNow);
            (0, vitest_1.expect)(result.toISOString()).toBe("2026-06-17T12:00:00.000Z");
        });
        (0, vitest_1.it)("should parse string amount and handle dateOnly by starting of day", () => {
            const baseDate = new Date("2026-06-15T14:30:00.000Z");
            const result = dateUtil.expiredAt("5", "hours", baseDate, true, fixedNow);
            // 5 hours added to 14:30 is 19:30, but dateOnly: true floors it to start of day (00:00:00)
            (0, vitest_1.expect)(result.toISOString()).toBe("2026-06-15T00:00:00.000Z");
        });
        (0, vitest_1.it)("should fallback to 'now' when dateTime is null", () => {
            const result = dateUtil.expiredAt(1, "days", null, false, fixedNow);
            (0, vitest_1.expect)(result.toISOString()).toBe("2026-06-16T12:00:00.000Z");
        });
    });
    (0, vitest_1.describe)("unix & toMs", () => {
        (0, vitest_1.it)("should return millisecond timestamp for a Date object", () => {
            const date = new Date("2026-06-15T12:00:00.000Z");
            (0, vitest_1.expect)(dateUtil.unix(date, fixedNow)).toBe(1781524800000);
            (0, vitest_1.expect)(dateUtil.toMs(date, fixedNow)).toBe(1781524800000);
        });
        (0, vitest_1.it)("should parse string/number dates and handle fallbacks correctly", () => {
            const timestamp = 1781524800000;
            (0, vitest_1.expect)(dateUtil.toMs(timestamp, fixedNow)).toBe(timestamp);
            const stringDate = "2026-06-15T12:00:00.000Z";
            (0, vitest_1.expect)(dateUtil.toMs(stringDate, fixedNow)).toBe(1781524800000);
            // Null/undefined fallback to 'now'
            (0, vitest_1.expect)(dateUtil.toMs(null, fixedNow)).toBe(fixedNow.getTime());
        });
    });
    (0, vitest_1.describe)("isPast", () => {
        (0, vitest_1.it)("should return true if the date is in the past relative to now", () => {
            const pastDate = new Date("2020-01-01T00:00:00.000Z");
            (0, vitest_1.expect)(dateUtil.isPast(pastDate, fixedNow)).toBe(true);
        });
        (0, vitest_1.it)("should return false if the date is in the future relative to now", () => {
            const futureDate = new Date("2030-01-01T00:00:00.000Z");
            (0, vitest_1.expect)(dateUtil.isPast(futureDate, fixedNow)).toBe(false);
        });
    });
});
