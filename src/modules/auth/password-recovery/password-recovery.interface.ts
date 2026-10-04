// src/modules/auth/password-recovery/password-recovery.interface.ts

export const RECOVERY_EMAIL = "email";
export const RECOVERY_PHONE = "phone";
export const TYPES = [RECOVERY_EMAIL, RECOVERY_PHONE] as const;
export type Type = (typeof TYPES)[number];

export interface PasswordRecovery {
    id: number;
    type: Type;
    send_to: string;
    code: string;
    next_resend_at: Date | string;
    expired_at: Date | string;
    tries: number;
    next_try_at: Date | string | null;
    created_at: Date | string | null;
    updated_at: Date | string | null;
}

export interface PasswordRecoveryCreateData {
    type: Type;
    send_to: string;
    code: string;
    next_resend_at: Date;
    expired_at: Date;
    tries?: number;
    next_try_at?: Date | null;
}

export interface PasswordRecoveryResult {
    sent: boolean;
    nextResendAt?: Date;
}

export interface PasswordRecoverySendRequest {
    type: Type;
    send_to: string;
}

export interface PasswordRecoveryValidateRequest
    extends PasswordRecoverySendRequest {
    code: string;
    new_password: string;
}
