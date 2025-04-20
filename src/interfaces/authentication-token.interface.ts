export interface AuthenticationTokenInterface {
    id: number;
    user_id: number;
    token: string;
    is_tfa_required: number;
    is_tfa_verified: number;
    created_at: string | null;
    updated_at: string | null;
    expired_at: string | null;
}