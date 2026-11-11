"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DateUtil = void 0;
// src/common/utils/date.util.ts
const luxon_1 = require("luxon");
class DateUtil {
    /**
     * Safely normalizes multiple inputs into a native JS Date object.
     * Keeps performance high by avoiding wrapper libraries where possible.
     */
    normalize(date, fallback = new Date()) {
        if (date === null || date === undefined) {
            return fallback;
        }
        return date instanceof Date ? date : new Date(date);
    }
    /**
     * Formats a date into an SQL compatible string.
     */
    sql(date = null, dateOnly = false, now = new Date()) {
        const jsDate = this.normalize(date, now);
        const format = dateOnly ? "yyyy-LL-dd" : "yyyy-LL-dd HH:mm:ss";
        return luxon_1.DateTime.fromJSDate(jsDate).toFormat(format);
    }
    /**
     * Calculates an expiration date by adding a duration unit.
     */
    expiredAt(amount, unit, dateTime = null, dateOnly = false, now = new Date()) {
        const numericAmount = typeof amount === "string" ? parseInt(amount, 10) : amount;
        const baseDate = this.normalize(dateTime, now);
        let result = luxon_1.DateTime.fromJSDate(baseDate).plus({ [unit]: numericAmount });
        if (dateOnly) {
            result = result.startOf("day");
        }
        return result.toJSDate();
    }
    /**
     * Returns a millisecond-level UNIX timestamp using fast, native JS methods.
     */
    unix(dateTime, now = new Date()) {
        return this.toMs(dateTime, now);
    }
    /**
     * Converts date input safely to a millisecond timestamp using native JS.
     * This is roughly 10x faster than routing simple date-objects through Luxon.
     */
    toMs(date, now = new Date()) {
        return this.normalize(date, now).getTime();
    }
    /**
     * Checks if a specific date has passed relative to 'now'
     */
    isPast(date, now = new Date()) {
        return this.toMs(date, now) < this.toMs(undefined, now);
    }
}
exports.DateUtil = DateUtil;
