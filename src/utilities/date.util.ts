import {DateTime} from "luxon";

export function DateUtil() {
    return {
        sql(date: (Date | string | null) = null, dateOnly = false): string {
            date = date == null ? new Date() : new Date(date);

            if (dateOnly) return DateTime.fromJSDate(date).toFormat("yyyy-LL-dd");

            return DateTime.fromJSDate(date).toFormat("yyyy-LL-dd HH:mm:ss");
        },

        expiredAt(amount: number | string, unit: string, dateTime = new Date(), dateOnly = false): string {
            amount = typeof amount === "string" ? parseInt(amount) : amount;
            if (typeof dateTime === "undefined" || dateTime == null) dateTime = new Date();

            let duration: any = {};
            duration[unit] = amount;

            if (dateOnly) return DateTime.fromJSDate(dateTime).plus(duration).toFormat("yyyy-LL-dd");

            return DateTime.fromJSDate(dateTime).plus(duration).toFormat("yyyy-LL-dd HH:mm:ss");
        },

        unix(dateTime = new Date()): number {
            return DateTime.fromJSDate(dateTime).valueOf();
        },
    };
}