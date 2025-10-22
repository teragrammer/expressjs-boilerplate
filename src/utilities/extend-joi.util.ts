import Joi, {ObjectSchema} from "joi";
import {Response} from "express";
import {PhoneNumberUtil} from "google-libphonenumber";
import errors from "../configurations/errors";
import {Knex} from "knex";

const phoneUtil = PhoneNumberUtil.getInstance();

export function ExtendJoiUtil() {
    return {
        async response(schema: ObjectSchema, data: any, res: Response) {
            try {
                await schema.validateAsync(data, {abortEarly: false});

                return false;
            } catch (error: any) {
                // Format error response
                const e = error.details.map((err: any) => {
                    const field = err.message.replace(/^"|"$|"/g, "");

                    return {
                        field: err.path[0],
                        message: field
                            .split("_")
                            .map((word: any) => (word.toLowerCase() === "id" ? "ID" : word.charAt(0).toUpperCase() + word.slice(1)))
                            .join(" "),
                    };
                });

                res.status(400).json({
                    code: errors.VALIDATION_FAILED.code,
                    message: errors.VALIDATION_FAILED.message,
                    errors: e,
                });

                return true;
            }
        },

        phone(value: any, helpers: any) {
            if (typeof value === "undefined" || value === null) return value;

            try {
                const number = phoneUtil.parse(value); // .parseAndKeepRawInput(value, 'PH'), Change region if needed
                if (!phoneUtil.isValidNumber(number)) {
                    return helpers.error("any.invalid");
                }
                return value; // Valid number
            } catch (error) {
                return helpers.error("any.invalid");
            }
        },

        exists(db: Knex, table: string, column: string = "id") {
            return async (value: any, helpers: any) => {
                if (typeof value === "undefined" || value === null) return value;

                const fieldName = helpers.state.path[0];
                const message = `${fieldName} does not exist`;

                const query = await db.table(table).where(column, value).first();
                if (!query) throw new Joi.ValidationError(message, [
                    {
                        message: message,
                        path: [fieldName],
                        type: "any.external",
                    },
                ], undefined);

                return value;
            };
        },

        unique(db: Knex, table: string, column: string, ignore: any = null) {
            return async (value: any, helpers: any) => {
                if (typeof value === "undefined" || value === null) return value;

                const fieldName = helpers.state.path[0];
                const message = `${fieldName} is already exists`;

                if (ignore !== null) {
                    const query = await db.table(table)
                        .where(column, value)
                        .where("id", "<>", ignore)
                        .first();
                    if (query) throw new Joi.ValidationError(message, [
                        {
                            message: message,
                            path: [fieldName],
                            type: "any.external",
                        },
                    ], undefined);
                } else {
                    const query = await db.table(table)
                        .where(column, value)
                        .first();
                    if (query) throw new Joi.ValidationError(message, [
                        {
                            message: message,
                            path: [fieldName],
                            type: "any.external",
                        },
                    ], undefined);
                }

                return value;
            };
        },
    };
}