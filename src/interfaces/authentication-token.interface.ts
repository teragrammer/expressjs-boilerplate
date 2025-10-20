export interface AuthenticationTokenInterface {
    id: number;
    user_id: number;
    created_at: string | null;
    updated_at: string | null;
    expired_at: string | null;
}