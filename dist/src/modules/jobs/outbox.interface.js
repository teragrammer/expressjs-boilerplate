"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OUTBOX_TYPES = void 0;
// src/modules/jobs/outbox.interface.ts
exports.OUTBOX_TYPES = {
    SEND_EMAIL: "email.send",
    CLEANUP_EXPIRED_SESSIONS: "cleanup.expired_sessions",
    CLEANUP_EXPIRED_RECOVERIES: "cleanup.expired_recoveries",
    CLEANUP_EXPIRED_TFA: "cleanup.expired_tfa",
    CLEANUP_EXPIRED_REFRESH_TOKENS: "cleanup.expired_refresh_tokens",
    CLEANUP_EXPIRED_VERIFICATIONS: "cleanup.expired_verifications",
    CLEANUP_RATE_LIMITS: "cleanup.rate_limits",
    CLEANUP_EXPIRED_IDEMPOTENCY_KEYS: "cleanup.idempotency_keys",
};
