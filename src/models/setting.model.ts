import {Knex} from "knex";
import {SettingInterface} from "../interfaces/setting.interface";
import {SettingKeyValueInterface} from "../interfaces/setting-key-value.interface";

const TABLE_NAME = "settings";

export const DATA_TYPES = ["string", "integer", "float", "boolean", "array"];
export const CACHE_SETT_NAME = "cache_settings";
export interface InitializerSettingInterface {
    pri: SettingKeyValueInterface;
    pub: SettingKeyValueInterface;
}

export function SettingModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),

        value: async (slug: string [] = [], is_public?: number): Promise<SettingKeyValueInterface> => {
            const OBJ_KEY: any = {};
            const PREPARED_QUERY = knex.table(TABLE_NAME).where("is_disabled", 0);
            let settings: SettingInterface[] | undefined;

            if (typeof is_public !== "undefined") {
                PREPARED_QUERY!.where("is_public", is_public);
            }

            if (slug.length) {
                PREPARED_QUERY!.whereIn("slug", slug);
            }

            settings = await PREPARED_QUERY;

            // values
            if (settings && settings.length) {
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

                    OBJ_KEY[settings[i].slug] = value;
                }
            }

            return OBJ_KEY;
        },

        initializer: async (): Promise<InitializerSettingInterface> => {
            const INTERNAL: SettingKeyValueInterface = await SettingModel(knex).value();
            const EXTERNAL: SettingKeyValueInterface = await SettingModel(knex).value([], 1);

            return {
                pri: INTERNAL,
                pub: EXTERNAL,
            };
        },
    };
}