// src/modules/auth/authentication/authentication.interface.ts
import {JwtPayload} from "jsonwebtoken";

export interface LoginInput {
    username: string;
    password: string;
}

export interface RegisterInput {
    first_name: string;
    middle_name?: string; // Optional field
    last_name: string;
    username: string;
    password: string;
    email: string;
}

export interface AuthenticationToken {
    id: number;
    user_id: number | null;
    tries?: number;
    expired_at: Date | string | null;
    ip: string | null;
    browser: string | null;
    os: string | null;
    created_at: Date | string | null;
    updated_at: Date | string | null;
}

export type CreateAuthenticationTokenInput = Omit<AuthenticationToken, "id" | "created_at" | "updated_at">;
export type UpdateAuthenticationTokenInput = Partial<CreateAuthenticationTokenInput>;

export interface JwtExtendedPayload extends JwtPayload {
    uid: number;
    tid: number;
    tfa: boolean; // if true continue without validation, false need 2fa validation
}
