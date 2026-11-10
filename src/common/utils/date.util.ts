// src/common/utils/date.util.ts
import {DateTime, DurationUnit} from "luxon";

export class DateUtil {
    /**
     * Safely normalizes multiple inputs into a native JS Date object.
     * Keeps performance high by avoiding wrapper libraries where possible.
     */
    private normalize(date?: Date | string | number | null, fallback = new Date()): Date {
        if (date === null || date === undefined) {return fallback;}
        return date instanceof Date ? date : new Date(date);
    }

    /**
     * Formats a date into an SQL compatible string.
     */
    sql(date: Date | string | null = null, dateOnly = false, now = new Date()): string {
        const jsDate = this.normalize(date, now);
        const format = dateOnly ? "yyyy-LL-dd" : "yyyy-LL-dd HH:mm:ss";
        return DateTime.fromJSDate(jsDate).toFormat(format);
    }

    /**
     * Calculates an expiration date by adding a duration unit.
     */
    expiredAt(
        amount: number | string,
        unit: DurationUnit,
        dateTime: Date | string | null = null,
        dateOnly = false,
        now = new Date()
    ): Date {
        const numericAmount = typeof amount === "string" ? parseInt(amount, 10) : amount;
        const baseDate = this.normalize(dateTime, now);

        let result = DateTime.fromJSDate(baseDate).plus({[unit]: numericAmount});

        if (dateOnly) {
            result = result.startOf("day");
        }

        return result.toJSDate();
    }

    /**
     * Returns a millisecond-level UNIX timestamp using fast, native JS methods.
     */
    unix(dateTime?: Date | string | number, now = new Date()): number {
        return this.toMs(dateTime, now);
    }

    /**
     * Converts date input safely to a millisecond timestamp using native JS.
     * This is roughly 10x faster than routing simple date-objects through Luxon.
     */
    toMs(date?: Date | string | number | null, now = new Date()): number {
        return this.normalize(date, now).getTime();
    }

    /**
     * Checks if a specific date has passed relative to 'now'
     */
    isPast(date: Date | string | number, now = new Date()): boolean {
        return this.toMs(date, now) < this.toMs(undefined, now);
    }
}