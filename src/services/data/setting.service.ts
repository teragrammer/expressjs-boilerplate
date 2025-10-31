import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import {InitializerSettingInterface, SettingModel} from "../../models/setting.model";
import {Knex} from "knex";
import {SettingInterface} from "../../interfaces/setting.interface";

const INITIALIZER = async (knex: Knex): Promise<InitializerSettingInterface> => {
    const INTERNAL: SettingKeyValueInterface = await SettingModel(knex).value();
    const EXTERNAL: SettingKeyValueInterface = await SettingModel(knex).value([], 1);

    return {
        pri: INTERNAL,
        pub: EXTERNAL,
    };
};

export interface SettingValueOptionInterface {
    slug: string [];
    is_public?: number;
}

const QUERY_SETTINGS = async (knex: Knex, slug: string [] = [], is_public?: number): Promise<SettingInterface[]> => {
    const PREPARED_QUERY = SettingModel(knex).table().where("is_disabled", 0);
    if (typeof is_public !== "undefined") PREPARED_QUERY!.where("is_public", is_public);
    if (slug.length) PREPARED_QUERY!.whereIn("slug", slug);

    return PREPARED_QUERY;
};

const VALUE = async (knex: Knex, options: SettingValueOptionInterface): Promise<SettingKeyValueInterface> => {
    const OBJ_KEY: any = {};
    let settings: SettingInterface[] | undefined = await QUERY_SETTINGS(knex, options.slug, options.is_public);

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
};

export const SettingService = () => {
    return {
        initializer: INITIALIZER,
        value: VALUE,
    };
};