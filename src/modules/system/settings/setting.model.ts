import {SettingKeyValue} from "./setting-key-value.interface";

export const SETTING_TABLE = "settings";

export const DATA_TYPES = ["string", "integer", "float", "boolean", "array"];

export const SET_CACHE_SETTINGS = "cache:settings";

export interface InitializerSettingInterface {
    pri: SettingKeyValue;
    pub: SettingKeyValue;
}
