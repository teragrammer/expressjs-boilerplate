export interface AuthenticationTokenInterface {
    id: number;
    user_id: number;
    expired_at: string | null;
    ip: string | null;
    browser: string | null;
    os: string | null;
    created_at: string | null;
    updated_at: string | null;
}