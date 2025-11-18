import {Knex} from "knex";
import {SettingKeyValueInterface} from "../interfaces/setting-key-value.interface";
import {DBKnex} from "../configurations/knex";

export const SETTING_TABLE = "settings";

export const DATA_TYPES = ["string", "integer", "float", "boolean", "array"];

export const SET_CACHE_SETTINGS = "set_cache_settings";

export interface InitializerSettingInterface {
    pri: SettingKeyValueInterface;
    pub: SettingKeyValueInterface;
}

export function SettingModel(knex?: Knex) {
    return {
        table: () => (knex ? knex : DBKnex).table(SETTING_TABLE),
    };
}