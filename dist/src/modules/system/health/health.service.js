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
exports.HealthService = void 0;
// src/modules/system/health/health.service.ts
const kysely_1 = require("kysely");
const database_1 = require("../../../config/database");
const redis_1 = require("../../../config/redis");
const logger_1 = require("../../../config/logger");
/**
 * Readiness cache.
 *
 * Probes run on a timer so an orchestrator polling every second does
 * not translate into a database query per second.
 */
const READINESS_TTL_MS = 5000;
let cachedReport = null;
/**
 * Checks PostgreSQL with a lightweight query.
 */
function checkDatabase() {
    return __awaiter(this, arguments, void 0, function* (executor = database_1.db) {
        try {
            yield (0, kysely_1.sql) `SELECT 1`.execute(executor);
            return "up";
        }
        catch (error) {
            logger_1.logger.error(`Readiness database check failed: ${error.message}`);
            return "down";
        }
    });
}
/**
 * Checks Redis when it is configured.
 */
function checkRedis() {
    if (!redis_1.DBRedis.publisher) {
        return "disabled";
    }
    const status = redis_1.DBRedis.publisher.status;
    return status === "ready" || status === "connect" ? "up" : "down";
}
class HealthService {
    /**
     * Liveness: the process is up and the event loop is responsive.
     *
     * No dependency checks are performed; a liveness probe must not
     * fail because a downstream service is unavailable.
     */
    live() {
        return {
            status: "alive",
            uptimeSeconds: Math.round(process.uptime()),
        };
    }
    /**
     * Readiness: the process can serve traffic.
     *
     * The result is cached for a few seconds to keep probe traffic away
     * from the database.
     */
    ready() {
        return __awaiter(this, void 0, void 0, function* () {
            if (cachedReport && cachedReport.expiresAt > Date.now()) {
                return cachedReport.report;
            }
            const database = yield checkDatabase();
            const redis = checkRedis();
            const report = {
                status: database === "up" && redis !== "down"
                    ? "ready"
                    : "not_ready",
                dependencies: { database, redis },
            };
            cachedReport = {
                report,
                expiresAt: Date.now() + READINESS_TTL_MS,
            };
            return report;
        });
    }
}
exports.HealthService = HealthService;
