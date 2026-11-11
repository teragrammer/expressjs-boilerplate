// src/modules/jobs/outbox.interface.ts
export const OUTBOX_TYPES = {
    SEND_EMAIL: "email.send",
    CLEANUP_EXPIRED_SESSIONS: "cleanup.expired_sessions",
    CLEANUP_EXPIRED_RECOVERIES: "cleanup.expired_recoveries",
    CLEANUP_EXPIRED_TFA: "cleanup.expired_tfa",
    CLEANUP_EXPIRED_REFRESH_TOKENS: "cleanup.expired_refresh_tokens",
    CLEANUP_EXPIRED_VERIFICATIONS: "cleanup.expired_verifications",
    CLEANUP_RATE_LIMITS: "cleanup.rate_limits",
    CLEANUP_EXPIRED_IDEMPOTENCY_KEYS: "cleanup.idempotency_keys",
} as const;

export type OutboxType =
    (typeof OUTBOX_TYPES)[keyof typeof OUTBOX_TYPES];

export type OutboxStatus = "pending" | "processing" | "done" | "failed";

export interface OutboxEvent {
    id: string;
    type: string;
    payload: Record<string, unknown>;
    status: OutboxStatus;
    attempts: number;
    available_at: Date | string;
    locked_at: Date | string | null;
    locked_by: string | null;
    last_error: string | null;
    created_at: Date | string;
    processed_at: Date | string | null;
}

export interface CreateOutboxEvent {
    type: OutboxType;
    payload: Record<string, unknown>;
    availableAt?: Date;
}

/**
 * Context handed to an outbox handler.
 */
export interface OutboxHandlerContext {
    event: OutboxEvent;
    /** Identifier of the worker processing the event. */
    workerId: string;
}

export type OutboxHandler = (
    context: OutboxHandlerContext,
) => Promise<void>;
