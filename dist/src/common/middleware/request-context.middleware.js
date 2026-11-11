"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRouteTemplate = getRouteTemplate;
exports.requestContextMiddleware = requestContextMiddleware;
exports.requestLoggingMiddleware = requestLoggingMiddleware;
// src/common/middleware/request-context.middleware.ts
const node_crypto_1 = require("node:crypto");
const request_context_1 = require("../context/request-context");
const logger_1 = require("../../config/logger");
const REQUEST_ID_HEADER = "x-request-id";
/** Maximum accepted length of a client-supplied request id. */
const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;
/**
 * Validates a client-supplied request id.
 *
 * Arbitrary or oversized values are rejected so a caller cannot inject
 * unbounded content into the log stream.
 */
function sanitizeRequestId(value) {
    if (typeof value !== "string") {
        return undefined;
    }
    const trimmed = value.trim();
    if (trimmed.length === 0 ||
        trimmed.length > MAX_REQUEST_ID_LENGTH ||
        !SAFE_REQUEST_ID.test(trimmed)) {
        return undefined;
    }
    return trimmed;
}
/**
 * Resolves the route template of a request.
 *
 * Express only knows the matched route after routing completes, so
 * this returns `undefined` before the handler runs.
 */
function getRouteTemplate(req) {
    const route = req.route;
    return route === null || route === void 0 ? void 0 : route.path;
}
/**
 * Establishes the per-request context.
 *
 * The request id is generated when the client does not supply a valid
 * one, and is always returned in the `X-Request-ID` response header.
 */
function requestContextMiddleware(req, res, next) {
    var _a, _b;
    const requestId = (_a = sanitizeRequestId(req.headers[REQUEST_ID_HEADER])) !== null && _a !== void 0 ? _a : (0, node_crypto_1.randomUUID)();
    res.setHeader("X-Request-ID", requestId);
    const context = {
        requestId,
        method: req.method,
        ip: req.ip,
        userAgent: (_b = req.get("user-agent")) !== null && _b !== void 0 ? _b : undefined,
        startedAt: Date.now(),
    };
    req.context = context;
    (0, request_context_1.runWithRequestContext)(context, () => {
        next();
    });
}
/**
 * Logs one structured line per completed request.
 *
 * Status, latency, route template and request id are included so an
 * incident can be reconstructed from logs alone.
 */
function requestLoggingMiddleware(req, res, next) {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1000000;
        const route = getRouteTemplate(req);
        // Keep the context in sync for anything that reads it later.
        (0, request_context_1.updateRequestContext)({ route });
        const context = req.context;
        const logPayload = {
            requestId: context === null || context === void 0 ? void 0 : context.requestId,
            method: req.method,
            route: route !== null && route !== void 0 ? route : req.path,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            userId: context === null || context === void 0 ? void 0 : context.userId,
            ip: context === null || context === void 0 ? void 0 : context.ip,
            userAgent: context === null || context === void 0 ? void 0 : context.userAgent,
        };
        if (res.statusCode >= 500) {
            logger_1.logger.error(logPayload, "Request failed");
            return;
        }
        if (res.statusCode >= 400) {
            logger_1.logger.warn(logPayload, "Request rejected");
            return;
        }
        logger_1.logger.info(logPayload, "Request completed");
    });
    next();
}
