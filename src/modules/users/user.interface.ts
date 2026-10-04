// src/modules/users/user.interface.ts
export const GENDERS = ["Male", "Female", "Other"] as const;
export type Gender = typeof GENDERS[number];

export const STATUSES = ["Activated", "Suspended", "Deactivated", "Pending"] as const;
export type Status = typeof STATUSES[number];

// Represents the actual raw row returned by the PostgreSQL driver
export interface UserRow {
    id: number;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    gender: Gender | null;
    address: string | null;
    phone: string | null;
    is_phone_verified: boolean;
    email: string | null;
    is_email_verified: boolean;
    has_tfa: boolean;
    tfa_secret: string | null;
    role_id: number;
    username: string | null;
    password: string | null;
    status: Status;
    login_tries: number;
    failed_login_expired_at: Date | null;
    comments: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

// Clean application model with native JS/TS types
export interface User {
    id: number;
    first_name: string | null;
    middle_name: string | null;
    last_name: string | null;
    gender: Gender | null;
    address: string | null;
    phone: string | null;
    is_phone_verified: boolean;
    email: string | null;
    is_email_verified: boolean;
    has_tfa: boolean;
    tfa_secret: string | null;
    role_id: number;
    username: string | null;
    password?: string | null; // Optionalized when querying to safely exclude sensitive passwords
    status: Status;
    login_tries: number;
    failed_login_expired_at: Date | null;
    comments: string | null;
    created_at: Date;
    updated_at: Date;
    deleted_at: Date | null;
}

// Data Transfer Objects (DTOs)
export interface CreateUserDTO {
    first_name?: string | null;
    middle_name?: string | null;
    last_name?: string | null;
    gender?: Gender | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    role_id: number;
    username?: string | null;
    password?: string | null;
    status?: Status;
    comments?: string | null;
    created_at?: string;
}

export type UpdateUserDTO = Partial<CreateUserDTO> & {
    is_phone_verified?: boolean;
    is_email_verified?: boolean;
    has_tfa?: boolean;
    tfa_secret?: string | null;
    login_tries?: number;
    failed_login_expired_at?: Date | null;
};

export interface SecurityAccountDTO {
    current_password: string;
    new_password?: string | null;
    password?: string | null;
    username?: string | null;
    email?: string | null;
    phone?: string | null;
}

export interface BrowseUsersQuery {
    role_id?: number;
    status?: Status;
    search?: string;
    cursor?: number;
    limit: number;
}

export interface BrowseUsersResult {
    data: User[];
    hasMore: boolean;
    nextCursor: number | null;
}