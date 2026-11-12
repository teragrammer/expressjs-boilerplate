// src/common/metrics/metrics.ts
import * as client from "@prometheus-io/client";
import {__ENV} from "../../config/environment";

/**
 * Metric registry.
 *
 * Labels are deliberately bounded: route templates and status codes are
 * used instead of raw URLs, user ids or emails, so cardinality cannot
 * grow with traffic.
 */
export const registry = new client.Registry();

registry.setDefaultLabels({
    service: "express-api",
    env: __ENV.NODE_ENV,
});

client.collectDefaultMetrics({register: registry, prefix: "app_"});

export const httpRequestsTotal = new client.Counter({
    name: "app_http_requests_total",
    help: "Total number of HTTP requests handled",
    labelNames: ["method", "route", "status"] as const,
    registers: [registry],
});

export const httpRequestDuration = new client.Histogram({
    name: "app_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
});

export const authAttemptsTotal = new client.Counter({
    name: "app_auth_attempts_total",
    help: "Authentication attempts by outcome",
    labelNames: ["event", "outcome"] as const,
    registers: [registry],
});

export const rateLimitRejectionsTotal = new client.Counter({
    name: "app_rate_limit_rejections_total",
    help: "Requests rejected by the rate limiter",
    labelNames: ["bucket"] as const,
    registers: [registry],
});

export const dbPoolConnections = new client.Gauge({
    name: "app_db_pool_connections",
    help: "PostgreSQL pool connection counts",
    labelNames: ["state"] as const,
    registers: [registry],
});

export const cacheOperationsTotal = new client.Counter({
    name: "app_cache_operations_total",
    help: "Cache operations by result",
    labelNames: ["operation", "result"] as const,
    registers: [registry],
});

export const outboxEventsTotal = new client.Counter({
    name: "app_outbox_events_total",
    help: "Outbox events processed by outcome",
    labelNames: ["type", "outcome"] as const,
    registers: [registry],
});

export const outboxQueueDepth = new client.Gauge({
    name: "app_outbox_queue_depth",
    help: "Number of pending outbox events",
    registers: [registry],
});

export const auditEventsTotal = new client.Counter({
    name: "app_audit_events_total",
    help: "Audit events written by action and outcome",
    labelNames: ["action", "outcome"] as const,
    registers: [registry],
});

/**
 * Renders the registry in the Prometheus text exposition format.
 */
export async function renderMetrics(): Promise<string> {
    return registry.metrics();
}
