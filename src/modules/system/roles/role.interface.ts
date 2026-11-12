// src/modules/system/roles/role.interface.ts
/**
 * Application/domain representation of a role.
 *
 * PostgreSQL booleans are mapped to native booleans by the repository.
 */
export interface Role {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    is_public: boolean;
    is_bypass_authorization: boolean;
    created_at: Date | null;
    updated_at: Date | null;
}

export interface CreateRoleDTO {
    name: string;
    slug: string;
    description?: string | null;
    is_public?: boolean;
    is_bypass_authorization?: boolean;
}

export type UpdateRoleDTO = Partial<CreateRoleDTO>;

export interface BrowseRoleQuery {
    is_public?: boolean;
    search?: string;
    page: number;
    perPage: number;
}
