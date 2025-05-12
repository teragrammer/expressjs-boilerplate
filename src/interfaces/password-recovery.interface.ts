export interface PasswordRecoveryInterface {
    id: number;
    type: string;
    send_to: string;
    code: string;
    next_resend_at: string;
    expired_at: string;
    tries: number;
    next_try_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}