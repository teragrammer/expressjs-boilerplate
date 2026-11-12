// src/modules/system/settings/setting.interface.ts
import {SettingKeyValue} from "./setting-key-value.interface";

/**
 * Supported data types for setting values in the database.
 *
 * The array is the single source of truth: the union type is derived
 * from it so the Joi schemas and the TypeScript contract cannot drift.
 */
export const DATA_TYPES = [
    "string",
    "integer",
    "float",
    "boolean",
    "array",
] as const;

export type SettingDataType = (typeof DATA_TYPES)[number];

/**
 * Application/domain representation.
 */
export interface Setting {
    id: number;
    name: string;
    slug: string;
    value: string | null;
    description: string | null;
    type: SettingDataType;
    is_disabled: boolean;
    is_public: boolean;
    created_at: Date | string;
    updated_at: Date | string;
}

/**
 * The unified shape returned by the SettingService initializer.
 */
export interface InitializerSetting {
    pri: SettingKeyValue;
    pub: SettingKeyValue;
}

export interface CreateSettingDTO {
    name: string;
    slug: string;
    value: string | null;
    description: string | null;
    type: SettingDataType;
    is_disabled?: boolean;
    is_public?: boolean;
}

export interface UpdateSettingDTO {
    name?: string;
    slug?: string;
    value?: string | null;
    description?: string | null;
    type?: SettingDataType;
    is_disabled?: boolean;
    is_public?: boolean;
}

export interface BrowseSettingQuery {
    is_disabled?: boolean;
    is_public?: boolean;
    type?: SettingDataType;
    search?: string;
    page: number;
    perPage: number;
}
