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
exports.MemoryRateLimiter = exports.RateLimiter = void 0;
// src/common/middleware/rate-limiter.ts
const kysely_1 = require("kysely");
const database_1 = require("../../config/database");
const logger_1 = require("../../config/logger");
class RateLimiter {
    constructor(db = database_1.db) {
        this.db = db;
    }
    /**
     * Attempts to consume a request from the rate limit bucket.
     * Uses atomic upsert to handle concurrent requests safely.
     */
    consume(key, maxRequests, windowSec) {
        return __awaiter(this, void 0, void 0, function* () {
            const expiresAt = new Date(Date.now() + windowSec * 1000);
            const now = new Date();
            try {
                // Atomic upsert: insert new or increment existing
                const result = yield this.db
                    .insertInto("rate_limits")
                    .values({
                    key,
                    bucket: key.split(":")[0] || "default",
                    count: 1,
                    expires_at: expiresAt,
                    created_at: now,
                    updated_at: now,
                })
                    .onConflict((oc) => oc.columns(["key", "bucket"]).doUpdateSet({
                    count: (0, kysely_1.sql) `rate_limits.count + 1`,
                    updated_at: now,
                    expires_at: (0, kysely_1.sql) `GREATEST(rate_limits.expires_at, ${expiresAt})`,
                }))
                    .returning(["count", "expires_at"])
                    .executeTakeFirstOrThrow();
                const count = Number(result.count);
                const resetAt = new Date(result.expires_at).getTime();
                return {
                    allowed: count <= maxRequests,
                    count,
                    remaining: Math.max(0, maxRequests - count),
                    resetAt,
                };
            }
            catch (error) {
                logger_1.logger.error(`Rate limiter consume error for key ${key}: ${error}`);
                // Fail open - allow request if rate limiter fails
                return {
                    allowed: true,
                    count: 0,
                    remaining: maxRequests,
                    resetAt: Date.now() + windowSec * 1000,
                };
            }
        });
    }
    /**
     * Decrements the count for a key (used when skipping successful/failed requests).
     */
    decrement(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [bucket] = key.split(":");
                yield this.db
                    .updateTable("rate_limits")
                    .set({
                    count: (0, kysely_1.sql) `GREATEST(rate_limits.count - 1, 0)`,
                    updated_at: new Date(),
                })
                    .where("key", "=", key)
                    .where("bucket", "=", bucket)
                    .execute();
            }
            catch (error) {
                logger_1.logger.error(`Rate limiter decrement error for key ${key}: ${error}`);
            }
        });
    }
    /**
     * Gets current rate limit status without consuming.
     */
    getStatus(key, maxRequests) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [bucket] = key.split(":");
                const result = yield this.db
                    .selectFrom("rate_limits")
                    .select(["count", "expires_at"])
                    .where("key", "=", key)
                    .where("bucket", "=", bucket)
                    .executeTakeFirst();
                if (!result) {
                    return {
                        allowed: true,
                        count: 0,
                        remaining: maxRequests,
                        resetAt: Date.now(),
                    };
                }
                const count = Number(result.count);
                const resetAt = new Date(result.expires_at).getTime();
                return {
                    allowed: count < maxRequests,
                    count,
                    remaining: Math.max(0, maxRequests - count),
                    resetAt,
                };
            }
            catch (error) {
                logger_1.logger.error(`Rate limiter getStatus error for key ${key}: ${error}`);
                return {
                    allowed: true,
                    count: 0,
                    remaining: maxRequests,
                    resetAt: Date.now(),
                };
            }
        });
    }
    /**
     * Resets rate limit for a specific key.
     */
    reset(key) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const [bucket] = key.split(":");
                yield this.db
                    .deleteFrom("rate_limits")
                    .where("key", "=", key)
                    .where("bucket", "=", bucket)
                    .execute();
            }
            catch (error) {
                logger_1.logger.error(`Rate limiter reset error for key ${key}: ${error}`);
            }
        });
    }
    /**
     * Cleans up expired rate limit entries.
     * Should be run periodically (e.g., via cron job).
     */
    cleanupExpired() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.db
                    .deleteFrom("rate_limits")
                    .where("expires_at", "<", new Date())
                    .executeTakeFirst();
                return Number(result.numDeletedRows);
            }
            catch (error) {
                logger_1.logger.error(`Rate limiter cleanup error: ${error}`);
                return 0;
            }
        });
    }
}
exports.RateLimiter = RateLimiter;
// In-memory fallback for when database is not available
class MemoryRateLimiter {
    constructor() {
        this.store = new Map();
        // Clean up expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        this.cleanupInterval.unref();
    }
    consume(key, maxRequests, windowSec) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            const resetAt = now + windowSec * 1000;
            let entry = this.store.get(key);
            if (!entry || entry.resetAt < now) {
                entry = { count: 0, resetAt };
                this.store.set(key, entry);
            }
            entry.count++;
            entry.resetAt = Math.max(entry.resetAt, resetAt);
            return {
                allowed: entry.count <= maxRequests,
                count: entry.count,
                remaining: Math.max(0, maxRequests - entry.count),
                resetAt: entry.resetAt,
            };
        });
    }
    decrement(key) {
        return __awaiter(this, void 0, void 0, function* () {
            const entry = this.store.get(key);
            if (entry) {
                entry.count = Math.max(0, entry.count - 1);
            }
        });
    }
    getStatus(key, maxRequests) {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            const entry = this.store.get(key);
            if (!entry || entry.resetAt < now) {
                return { allowed: true, count: 0, remaining: maxRequests, resetAt: now };
            }
            return {
                allowed: entry.count < maxRequests,
                count: entry.count,
                remaining: Math.max(0, maxRequests - entry.count),
                resetAt: entry.resetAt,
            };
        });
    }
    reset(key) {
        return __awaiter(this, void 0, void 0, function* () {
            this.store.delete(key);
        });
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            const now = Date.now();
            let cleaned = 0;
            for (const [key, entry] of this.store.entries()) {
                if (entry.resetAt < now) {
                    this.store.delete(key);
                    cleaned++;
                }
            }
            return cleaned;
        });
    }
    destroy() {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}
exports.MemoryRateLimiter = MemoryRateLimiter;
