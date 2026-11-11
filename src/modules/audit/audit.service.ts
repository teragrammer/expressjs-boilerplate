// src/modules/audit/audit.service.ts
import {Request} from "express";
import {__ENV} from "../../config/environment";
import {logger} from "../../config/logger";
import {auditEventsTotal} from "../../common/metrics/metrics";
import {getRequestContext} from "../../common/context/request-context";
import {AuditRepository} from "./audit.repository";
import {
    AuditAction,
    AuditEvent,
    AuditLogEntry,
    AuditOutcome,
    BrowseAuditQuery,
} from "./audit.interface";

/**
 * Keys whose values are never written to the audit trail.
 */
const REDACTED_KEYS = new Set([
    "password",
    "new_password",
    "current_password",
    "code",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "authorization",
]);

/**
 * Recursively redacts sensitive values from audit metadata.
 *
 * Emails and phone numbers are masked so the trail stays useful for
 * investigation without becoming a PII store.
 */
export function redactMetadata(
    value: unknown,
    depth = 0,
): unknown {
    if (depth > 5) {
        return "[TRUNCATED]";
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactMetadata(item, depth + 1));
    }

    if (value && typeof value === "object") {
        const result: Record<string, unknown> = {};

        for (const [key, entry] of Object.entries(
            value as Record<string, unknown>,
        )) {
            if (REDACTED_KEYS.has(key.toLowerCase())) {
                result[key] = "[REDACTED]";
                continue;
            }

            result[key] = redactMetadata(entry, depth + 1);
        }

        return result;
    }

    if (typeof value === "string") {
        return maskIdentifier(value);
    }

    return value;
}

/**
 * Masks an email address or phone number.
 */
function maskIdentifier(value: string): string {
    if (value.includes("@")) {
        const [local, domain] = value.split("@");

        return `${local.slice(0, 1)}***@${domain}`;
    }

    if (/^\+?[0-9]{7,}$/.test(value)) {
        return `${value.slice(0, 3)}***${value.slice(-2)}`;
    }

    return value;
}

export class AuditService {
    constructor(
        private readonly auditRepository: AuditRepository,
    ) {
    }

    /**
     * Records a security or administrative event.
     *
     * Audit failures never break the business operation: the event is
     * logged and the request continues.
     */
    async record(
        event: AuditEvent & {
            request?: Request;
        },
    ): Promise<void> {
        if (!__ENV.AUDIT_ENABLED) {
            return;
        }

        const context = getRequestContext();
        const request = event.request;

        const payload: AuditEvent = {
            action: event.action,
            outcome: event.outcome,
            actorUserId:
                event.actorUserId ??
                request?.credentials?.jwt?.uid ??
                null,
            actorType:
                event.actorType ??
                (request?.credentials?.jwt?.uid
                    ? "user"
                    : "anonymous"),
            targetType: event.targetType ?? null,
            targetId: event.targetId ?? null,
            requestId:
                event.requestId ??
                context?.requestId ??
                request?.context?.requestId ??
                null,
            ip: event.ip ?? context?.ip ?? request?.ip ?? null,
            userAgent:
                event.userAgent ??
                context?.userAgent ??
                request?.get("user-agent") ??
                null,
            metadata: (redactMetadata(event.metadata ?? {}) as Record<
                string,
                unknown
            >),
        };

        try {
            await this.auditRepository.append(payload);

            auditEventsTotal.inc({
                action: event.action,
                outcome: event.outcome,
            });
        } catch (error) {
            logger.error(
                {
                    action: event.action,
                    message: (error as Error).message,
                },
                "Failed to write audit event",
            );
        }
    }

    /**
     * Convenience wrapper for a successful event.
     */
    async success(
        action: AuditAction,
        event: Omit<AuditEvent, "action" | "outcome"> & {
            request?: Request;
        } = {},
    ): Promise<void> {
        await this.record({...event, action, outcome: "success"});
    }

    /**
     * Convenience wrapper for a failed event.
     */
    async failure(
        action: AuditAction,
        event: Omit<AuditEvent, "action" | "outcome"> & {
            request?: Request;
        } = {},
    ): Promise<void> {
        await this.record({...event, action, outcome: "failure"});
    }

    /**
     * Lists audit events for the read API.
     */
    async browse(
        filters: BrowseAuditQuery,
    ): Promise<{items: AuditLogEntry[]; total: number}> {
        const [items, total] = await Promise.all([
            this.auditRepository.browse(filters),
            this.auditRepository.count(filters),
        ]);

        return {items, total};
    }
}
