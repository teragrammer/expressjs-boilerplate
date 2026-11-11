// src/common/middleware/rate-limiter.ts
import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../config/database";
import {logger} from "../../config/logger";

export interface RateLimitResult {
    allowed: boolean;
    count: number;
    remaining: number;
    resetAt: number;
}

export class RateLimiter {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    /**
     * Attempts to consume a request from the rate limit bucket.
     * Uses atomic upsert to handle concurrent requests safely.
     */
    async consume(key: string, maxRequests: number, windowSec: number): Promise<RateLimitResult> {
        const expiresAt = new Date(Date.now() + windowSec * 1000);
        const now = new Date();

        try {
            // Atomic upsert: insert new or increment existing
            const result = await this.db
                .insertInto("rate_limits")
                .values({
                    key,
                    bucket: key.split(":")[0] || "default",
                    count: 1,
                    expires_at: expiresAt,
                    created_at: now,
                    updated_at: now,
                })
                .onConflict((oc) =>
                    oc.columns(["key", "bucket"]).doUpdateSet({
                        count: sql<number>`rate_limits.count + 1`,
                        updated_at: now,
                        expires_at: sql`GREATEST(rate_limits.expires_at, ${expiresAt})`,
                    })
                )
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
        } catch (error) {
            logger.error(`Rate limiter consume error for key ${key}: ${error}`);

            // Fail open - allow request if rate limiter fails
            return {
                allowed: true,
                count: 0,
                remaining: maxRequests,
                resetAt: Date.now() + windowSec * 1000,
            };
        }
    }

    /**
     * Decrements the count for a key (used when skipping successful/failed requests).
     */
    async decrement(key: string): Promise<void> {
        try {
            const [bucket] = key.split(":");
            await this.db
                .updateTable("rate_limits")
                .set({
                    count: sql<number>`GREATEST(rate_limits.count - 1, 0)`,
                    updated_at: new Date(),
                })
                .where("key", "=", key)
                .where("bucket", "=", bucket)
                .execute();
        } catch (error) {
            logger.error(`Rate limiter decrement error for key ${key}: ${error}`);
        }
    }

    /**
     * Gets current rate limit status without consuming.
     */
    async getStatus(key: string, maxRequests: number): Promise<RateLimitResult> {
        try {
            const [bucket] = key.split(":");
            const result = await this.db
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
        } catch (error) {
            logger.error(`Rate limiter getStatus error for key ${key}: ${error}`);
            return {
                allowed: true,
                count: 0,
                remaining: maxRequests,
                resetAt: Date.now(),
            };
        }
    }

    /**
     * Resets rate limit for a specific key.
     */
    async reset(key: string): Promise<void> {
        try {
            const [bucket] = key.split(":");
            await this.db
                .deleteFrom("rate_limits")
                .where("key", "=", key)
                .where("bucket", "=", bucket)
                .execute();
        } catch (error) {
            logger.error(`Rate limiter reset error for key ${key}: ${error}`);
        }
    }

    /**
     * Cleans up expired rate limit entries.
     * Should be run periodically (e.g., via cron job).
     */
    async cleanupExpired(): Promise<number> {
        try {
            const result = await this.db
                .deleteFrom("rate_limits")
                .where("expires_at", "<", new Date())
                .executeTakeFirst();

            return Number(result.numDeletedRows);
        } catch (error) {
            logger.error(`Rate limiter cleanup error: ${error}`);
            return 0;
        }
    }
}

// In-memory fallback for when database is not available
export class MemoryRateLimiter {
    private readonly store = new Map<string, {count: number; resetAt: number}>();
    private readonly cleanupInterval: NodeJS.Timeout;

    constructor() {
        // Clean up expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
        this.cleanupInterval.unref();
    }

    async consume(key: string, maxRequests: number, windowSec: number): Promise<RateLimitResult> {
        const now = Date.now();
        const resetAt = now + windowSec * 1000;

        let entry = this.store.get(key);

        if (!entry || entry.resetAt < now) {
            entry = {count: 0, resetAt};
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
    }

    async decrement(key: string): Promise<void> {
        const entry = this.store.get(key);
        if (entry) {
            entry.count = Math.max(0, entry.count - 1);
        }
    }

    async getStatus(key: string, maxRequests: number): Promise<RateLimitResult> {
        const now = Date.now();
        const entry = this.store.get(key);

        if (!entry || entry.resetAt < now) {
            return {allowed: true, count: 0, remaining: maxRequests, resetAt: now};
        }

        return {
            allowed: entry.count < maxRequests,
            count: entry.count,
            remaining: Math.max(0, maxRequests - entry.count),
            resetAt: entry.resetAt,
        };
    }

    async reset(key: string): Promise<void> {
        this.store.delete(key);
    }

    async cleanup(): Promise<number> {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, entry] of this.store.entries()) {
            if (entry.resetAt < now) {
                this.store.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }

    destroy(): void {
        clearInterval(this.cleanupInterval);
        this.store.clear();
    }
}