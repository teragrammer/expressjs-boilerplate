"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditEventsTotal = exports.outboxQueueDepth = exports.outboxEventsTotal = exports.cacheOperationsTotal = exports.dbPoolConnections = exports.rateLimitRejectionsTotal = exports.authAttemptsTotal = exports.httpRequestDuration = exports.httpRequestsTotal = exports.registry = void 0;
exports.renderMetrics = renderMetrics;
// src/common/metrics/metrics.ts
const prom_client_1 = __importDefault(require("prom-client"));
const environment_1 = require("../../config/environment");
/**
 * Metric registry.
 *
 * Labels are deliberately bounded: route templates and status codes are
 * used instead of raw URLs, user ids or emails, so cardinality cannot
 * grow with traffic.
 */
exports.registry = new prom_client_1.default.Registry();
exports.registry.setDefaultLabels({
    service: "express-api",
    env: environment_1.__ENV.NODE_ENV,
});
prom_client_1.default.collectDefaultMetrics({ register: exports.registry, prefix: "app_" });
exports.httpRequestsTotal = new prom_client_1.default.Counter({
    name: "app_http_requests_total",
    help: "Total number of HTTP requests handled",
    labelNames: ["method", "route", "status"],
    registers: [exports.registry],
});
exports.httpRequestDuration = new prom_client_1.default.Histogram({
    name: "app_http_request_duration_seconds",
    help: "HTTP request duration in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [exports.registry],
});
exports.authAttemptsTotal = new prom_client_1.default.Counter({
    name: "app_auth_attempts_total",
    help: "Authentication attempts by outcome",
    labelNames: ["event", "outcome"],
    registers: [exports.registry],
});
exports.rateLimitRejectionsTotal = new prom_client_1.default.Counter({
    name: "app_rate_limit_rejections_total",
    help: "Requests rejected by the rate limiter",
    labelNames: ["bucket"],
    registers: [exports.registry],
});
exports.dbPoolConnections = new prom_client_1.default.Gauge({
    name: "app_db_pool_connections",
    help: "PostgreSQL pool connection counts",
    labelNames: ["state"],
    registers: [exports.registry],
});
exports.cacheOperationsTotal = new prom_client_1.default.Counter({
    name: "app_cache_operations_total",
    help: "Cache operations by result",
    labelNames: ["operation", "result"],
    registers: [exports.registry],
});
exports.outboxEventsTotal = new prom_client_1.default.Counter({
    name: "app_outbox_events_total",
    help: "Outbox events processed by outcome",
    labelNames: ["type", "outcome"],
    registers: [exports.registry],
});
exports.outboxQueueDepth = new prom_client_1.default.Gauge({
    name: "app_outbox_queue_depth",
    help: "Number of pending outbox events",
    registers: [exports.registry],
});
exports.auditEventsTotal = new prom_client_1.default.Counter({
    name: "app_audit_events_total",
    help: "Audit events written by action and outcome",
    labelNames: ["action", "outcome"],
    registers: [exports.registry],
});
/**
 * Renders the registry in the Prometheus text exposition format.
 */
function renderMetrics() {
    return __awaiter(this, void 0, void 0, function* () {
        return exports.registry.metrics();
    });
}
