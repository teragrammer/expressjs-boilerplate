import {Knex} from "knex";
import {SettingKeyValueInterface} from "../interfaces/setting-key-value.interface";
import {SettingService} from "../services/data/setting.service";

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

        value: async (slug: string [] = [], is_public?: number): Promise<SettingKeyValueInterface> => SettingService().value(knex, {
            slug,
            is_public,
        }),
    };
}