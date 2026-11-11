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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
exports.redactMetadata = redactMetadata;
const environment_1 = require("../../config/environment");
const logger_1 = require("../../config/logger");
const metrics_1 = require("../../common/metrics/metrics");
const request_context_1 = require("../../common/context/request-context");
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
function redactMetadata(value, depth = 0) {
    if (depth > 5) {
        return "[TRUNCATED]";
    }
    if (Array.isArray(value)) {
        return value.map((item) => redactMetadata(item, depth + 1));
    }
    if (value && typeof value === "object") {
        const result = {};
        for (const [key, entry] of Object.entries(value)) {
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
function maskIdentifier(value) {
    if (value.includes("@")) {
        const [local, domain] = value.split("@");
        return `${local.slice(0, 1)}***@${domain}`;
    }
    if (/^\+?[0-9]{7,}$/.test(value)) {
        return `${value.slice(0, 3)}***${value.slice(-2)}`;
    }
    return value;
}
class AuditService {
    constructor(auditRepository) {
        this.auditRepository = auditRepository;
    }
    /**
     * Records a security or administrative event.
     *
     * Audit failures never break the business operation: the event is
     * logged and the request continues.
     */
    record(event) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
            if (!environment_1.__ENV.AUDIT_ENABLED) {
                return;
            }
            const context = (0, request_context_1.getRequestContext)();
            const request = event.request;
            const payload = {
                action: event.action,
                outcome: event.outcome,
                actorUserId: (_d = (_a = event.actorUserId) !== null && _a !== void 0 ? _a : (_c = (_b = request === null || request === void 0 ? void 0 : request.credentials) === null || _b === void 0 ? void 0 : _b.jwt) === null || _c === void 0 ? void 0 : _c.uid) !== null && _d !== void 0 ? _d : null,
                actorType: (_e = event.actorType) !== null && _e !== void 0 ? _e : (((_g = (_f = request === null || request === void 0 ? void 0 : request.credentials) === null || _f === void 0 ? void 0 : _f.jwt) === null || _g === void 0 ? void 0 : _g.uid)
                    ? "user"
                    : "anonymous"),
                targetType: (_h = event.targetType) !== null && _h !== void 0 ? _h : null,
                targetId: (_j = event.targetId) !== null && _j !== void 0 ? _j : null,
                requestId: (_o = (_l = (_k = event.requestId) !== null && _k !== void 0 ? _k : context === null || context === void 0 ? void 0 : context.requestId) !== null && _l !== void 0 ? _l : (_m = request === null || request === void 0 ? void 0 : request.context) === null || _m === void 0 ? void 0 : _m.requestId) !== null && _o !== void 0 ? _o : null,
                ip: (_r = (_q = (_p = event.ip) !== null && _p !== void 0 ? _p : context === null || context === void 0 ? void 0 : context.ip) !== null && _q !== void 0 ? _q : request === null || request === void 0 ? void 0 : request.ip) !== null && _r !== void 0 ? _r : null,
                userAgent: (_u = (_t = (_s = event.userAgent) !== null && _s !== void 0 ? _s : context === null || context === void 0 ? void 0 : context.userAgent) !== null && _t !== void 0 ? _t : request === null || request === void 0 ? void 0 : request.get("user-agent")) !== null && _u !== void 0 ? _u : null,
                metadata: redactMetadata((_v = event.metadata) !== null && _v !== void 0 ? _v : {}),
            };
            try {
                yield this.auditRepository.append(payload);
                metrics_1.auditEventsTotal.inc({
                    action: event.action,
                    outcome: event.outcome,
                });
            }
            catch (error) {
                logger_1.logger.error({
                    action: event.action,
                    message: error.message,
                }, "Failed to write audit event");
            }
        });
    }
    /**
     * Convenience wrapper for a successful event.
     */
    success(action_1) {
        return __awaiter(this, arguments, void 0, function* (action, event = {}) {
            yield this.record(Object.assign(Object.assign({}, event), { action, outcome: "success" }));
        });
    }
    /**
     * Convenience wrapper for a failed event.
     */
    failure(action_1) {
        return __awaiter(this, arguments, void 0, function* (action, event = {}) {
            yield this.record(Object.assign(Object.assign({}, event), { action, outcome: "failure" }));
        });
    }
    /**
     * Lists audit events for the read API.
     */
    browse(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const [items, total] = yield Promise.all([
                this.auditRepository.browse(filters),
                this.auditRepository.count(filters),
            ]);
            return { items, total };
        });
    }
}
exports.AuditService = AuditService;
