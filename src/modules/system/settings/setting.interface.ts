// src/modules/system/settings/setting.interface.ts
import {SettingKeyValue} from "./setting-key-value.interface";

/**
 * Supported data types for setting values in the database.
 */
export type SettingDataType =
    | "string"
    | "integer"
    | "float"
    | "boolean"
    | "array";

/**
 * Raw database representation.
 *
 * PostgreSQL booleans come back as native booleans via node-postgres.
 */
export interface SettingRow {
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
