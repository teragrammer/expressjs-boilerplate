export interface RoleInterface {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    is_public: number;
    created_at: string | null;
    updated_at: string | null;
}