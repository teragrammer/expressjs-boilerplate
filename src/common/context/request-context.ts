// src/common/context/request-context.ts
import {AsyncLocalStorage} from "node:async_hooks";

/**
 * Per-request context shared by logs, audit events and metrics.
 */
export interface RequestContext {
    /** Correlation id echoed back to the client as `X-Request-ID`. */
    requestId: string;
    method: string;
    /** Route template (e.g. `/users/:id`), never the raw URL. */
    route?: string;
    /** Authenticated user id, when known. */
    userId?: number;
    /** Client IP as resolved by Express (respects `trust proxy`). */
    ip?: string;
    userAgent?: string;
    startedAt: number;
}

const storage = new AsyncLocalStorage<RequestContext>();

/**
 * Runs `callback` with `context` bound to the current async execution.
 */
export function runWithRequestContext<T>(
    context: RequestContext,
    callback: () => T,
): T {
    return storage.run(context, callback);
}

/**
 * Returns the active request context, if any.
 */
export function getRequestContext(): RequestContext | undefined {
    return storage.getStore();
}

/**
 * Returns the active request id, if any.
 */
export function getRequestId(): string | undefined {
    return storage.getStore()?.requestId;
}

/**
 * Updates fields on the active request context.
 *
 * Safe to call when no context is active: the call is a no-op.
 */
export function updateRequestContext(
    patch: Partial<RequestContext>,
): void {
    const context = storage.getStore();

    if (!context) {
        return;
    }

    Object.assign(context, patch);
}
