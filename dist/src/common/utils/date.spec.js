"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const date_util_1 = require("./date.util");
(0, vitest_1.describe)("DateUtil", () => {
    const dateUtil = new date_util_1.DateUtil();
    /**
     * Frozen time anchor:
     * Thursday, July 16, 2026, 12:00:00 UTC
     */
    const frozenNow = new Date("2026-07-16T12:00:00.000Z");
    (0, vitest_1.describe)("sql", () => {
        (0, vitest_1.it)("should format to full SQL datetime string when no date is provided", () => {
            const result = dateUtil.sql(null, false, frozenNow);
            (0, vitest_1.expect)(result).toBe("2026-07-16 12:00:00");
        });
        (0, vitest_1.it)("should format to SQL date-only string when dateOnly is true", () => {
            const result = dateUtil.sql(null, true, frozenNow);
            (0, vitest_1.expect)(result).toBe("2026-07-16");
        });
        (0, vitest_1.it)("should handle raw string inputs", () => {
            const result = dateUtil.sql("2026-12-25T18:30:00.000Z", false, frozenNow);
            (0, vitest_1.expect)(result).toBe("2026-12-25 18:30:00");
        });
        (0, vitest_1.it)("should handle native Date object inputs", () => {
            const inputDate = new Date("2026-01-01T00:00:00.000Z");
            const result = dateUtil.sql(inputDate, false, frozenNow);
            (0, vitest_1.expect)(result).toBe("2026-01-01 00:00:00");
        });
    });
    (0, vitest_1.describe)("expiredAt", () => {
        (0, vitest_1.it)("should add duration to system default 'now' when dateTime is null", () => {
            const result = dateUtil.expiredAt(15, "minutes", null, false, frozenNow);
            (0, vitest_1.expect)(result.toISOString()).toBe("2026-07-16T12:15:00.000Z");
        });
        (0, vitest_1.it)("should handle string-based numeric amounts", () => {
            const result = dateUtil.expiredAt("2", "hours", null, false, frozenNow);
            (0, vitest_1.expect)(result.toISOString()).toBe("2026-07-16T14:00:00.000Z");
        });
        (0, vitest_1.it)("should subtract time when passed negative amounts", () => {
            const result = dateUtil.expiredAt(-5, "days", null, false, frozenNow);
            (0, vitest_1.expect)(result.toISOString()).toBe("2026-07-11T12:00:00.000Z");
        });
        (0, vitest_1.it)("should truncate to start of day when dateOnly is true", () => {
            const result = dateUtil.expiredAt(3, "days", null, true, frozenNow);
            (0, vitest_1.expect)(result.getHours()).toBe(0);
            (0, vitest_1.expect)(result.getMinutes()).toBe(0);
            (0, vitest_1.expect)(result.getSeconds()).toBe(0);
            (0, vitest_1.expect)(result.getMilliseconds()).toBe(0);
        });
    });
    (0, vitest_1.describe)("toMs & unix", () => {
        (0, vitest_1.it)("should return correct milliseconds for a given date", () => {
            const inputDate = new Date("2026-07-16T12:00:00.000Z");
            const result = dateUtil.toMs(inputDate, frozenNow);
            (0, vitest_1.expect)(result).toBe(1784203200000);
        });
        (0, vitest_1.it)("should default to frozenNow when input is omitted", () => {
            const result = dateUtil.toMs(undefined, frozenNow);
            (0, vitest_1.expect)(result).toBe(frozenNow.getTime());
        });
        (0, vitest_1.it)("should default to frozenNow when input is null", () => {
            const result = dateUtil.toMs(null, frozenNow);
            (0, vitest_1.expect)(result).toBe(frozenNow.getTime());
        });
        (0, vitest_1.it)("should resolve string dates correctly", () => {
            const result = dateUtil.toMs("2026-07-16T12:00:00.000Z", frozenNow);
            (0, vitest_1.expect)(result).toBe(1784203200000);
        });
        (0, vitest_1.it)("should allow unix() to mirror toMs() behavior", () => {
            const result = dateUtil.unix(undefined, frozenNow);
            (0, vitest_1.expect)(result).toBe(frozenNow.getTime());
        });
    });
    (0, vitest_1.describe)("isPast", () => {
        (0, vitest_1.it)("should return true if the target date is in the past", () => {
            const pastDate = "2026-07-16T11:59:59.999Z";
            (0, vitest_1.expect)(dateUtil.isPast(pastDate, frozenNow)).toBe(true);
        });
        (0, vitest_1.it)("should return false if the target date is in the future", () => {
            const futureDate = "2026-07-16T12:00:00.001Z";
            (0, vitest_1.expect)(dateUtil.isPast(futureDate, frozenNow)).toBe(false);
        });
        (0, vitest_1.it)("should return false if the target date is identical to current time", () => {
            const currentDate = "2026-07-16T12:00:00.000Z";
            (0, vitest_1.expect)(dateUtil.isPast(currentDate, frozenNow)).toBe(false);
        });
    });
});
