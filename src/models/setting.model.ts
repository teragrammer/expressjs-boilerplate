import {Knex} from "knex";
import {SettingInterface} from "../interfaces/setting.interface";

const TABLE_NAME = "settings";
export const DATA_TYPES = ["string", "integer", "float", "boolean", "array"];

export function SettingModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),

        value: async (slug: string [] = [], is_public?: number): Promise<any> => {
            const values: any = {};
            let prepareQuery = knex.table(TABLE_NAME).where("is_disabled", 0);
            let settings: SettingInterface[] | undefined;

            if (typeof is_public !== "undefined") {
                prepareQuery!.where("is_public", is_public);
            }

            if (slug.length) {
                prepareQuery!.whereIn("slug", slug);
            }

            settings = await prepareQuery;

            // values
            if (settings) {
                for (let i = 0; i < settings.length; i++) {
                    let value: any = settings[i].value;

                    if (settings[i].type === "integer") {
                        value = value !== null ? parseInt(value) : 0;
                    } else if (settings[i].type === "float") {
                        value = value !== null ? parseFloat(value) : 0;
                    } else if (settings[i].type === "boolean") {
                        value = parseInt(value) === 1 ? 1 : 0;
                    } else if (settings[i].type === "array") {
                        value = value !== null ? value.split(",") : [];
                    }

                    values[settings[i].slug] = value;
                }
            }

            return values;
        },
    };
}