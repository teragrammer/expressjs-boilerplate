export interface SettingInterface {
    id: number;
    name: string;
    slug: string;
    value: string;
    description: string;
    type: string;
    is_disabled: number;
    is_public: number;
    created_at: string;
    updated_at: string;
}