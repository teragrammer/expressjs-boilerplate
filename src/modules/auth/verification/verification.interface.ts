// src/modules/auth/verification/verification.interface.ts
export type VerificationChannel = "email" | "phone";

export interface VerificationToken {
    id: string;
    user_id: number;
    channel: VerificationChannel;
    target: string;
    token_hash: string;
    expires_at: Date | string;
    consumed_at: Date | string | null;
    attempts: number;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface CreateVerificationTokenInput {
    user_id: number;
    channel: VerificationChannel;
    target: string;
    token_hash: string;
    expires_at: Date;
}

export interface SendVerificationResult {
    /** Always true: the response must not reveal target existence. */
    sent: boolean;
    expiresAt: Date;
}

export interface VerificationPolicy {
    /** Email verification lifetime in hours. */
    emailTtlHours: number;
    /** Phone verification lifetime in minutes. */
    phoneTtlMinutes: number;
    /** Maximum verification attempts per token. */
    maxAttempts: number;
    /** Whether a verified target is required for password recovery. */
    requiredForRecovery: boolean;
}
