export interface TwoFactorAuthenticationInterface {
    id: number;
    token_id: number;
    code: string;
    tries: number;
    next_send_at: string | null;        // for sending new code
    expired_tries_at: string | null;    // for failed attempts
    created_at: string | null;
    updated_at: string | null;
    expired_at: string | null;
}