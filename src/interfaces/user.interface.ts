import {RoleInterface} from "./role.interface";

export interface UserInterface {
    id: number;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    role_id: number;
    username: string | null;
    password?: string | null;
    status: string;
    comments: string | null;
    login_tries?: number;
    failed_login_expired_at?: string | null;
    created_at: string | null;
    updated_at: string | null;

    role?: RoleInterface | null;
}