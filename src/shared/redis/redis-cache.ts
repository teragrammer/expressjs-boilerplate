// src/shared/redis/redis-cache.ts
import {DBRedisInterface} from "../../config/redis";
import Redis from "ioredis";
import {SecurityUtil} from "../../common/utils/security.util";
import {cacheOperationsTotal} from "../../common/metrics/metrics";

export class RedisCache {
    private readonly publisher?: Redis;
    private readonly isEnabled: boolean;

    constructor(
        dbRedis: DBRedisInterface,
        private readonly securityUtil: SecurityUtil,
        private readonly logger: { info: (msg: string) => void; error: (msg: string) => void }
    ) {
        this.publisher = dbRedis.publisher;
        // The cache engine only needs the publisher to be defined and active
        this.isEnabled = dbRedis.publisher !== undefined;
    }

    /**
     * Checks if the write/read cache connection is healthy
     */
    isConnected(): boolean {
        if (!this.isEnabled || !this.publisher) {return false;}
        return this.publisher.status === "ready" || this.publisher.status === "connect";
    }

    /**
     * Securely retrieves and decrypts data from Redis
     */
    async get<T>(key: string): Promise<T | null> {
        try {
            if (!this.isConnected() || !this.publisher) {return null;}

            const securedData = await this.publisher.get(key);
            if (!securedData) {
                cacheOperationsTotal.inc({operation: "get", result: "miss"});
                return null;
            }

            const decryptedData = await this.securityUtil.unshield(securedData);

            cacheOperationsTotal.inc({operation: "get", result: "hit"});

            return JSON.parse(decryptedData) as T;
        } catch (err: any) {
            /*
             * A malformed or tampered entry must not break the request:
             * the caller falls back to the database.
             */
            cacheOperationsTotal.inc({operation: "get", result: "error"});

            this.logger.error(`Redis secure read failed for key ${key}: ${err.message}`);
            return null;
        }
    }

    /**
     * Securely encrypts, stores, and publishes changes to a Redis key/channel
     */
    async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        try {
            if (!this.isConnected() || !this.publisher) {return;}

            const rawString = JSON.stringify(value);
            const encryptedPayload = await this.securityUtil.shield(rawString);

            // Save encrypted value
            if (ttlSeconds) {
                await this.publisher.set(key, encryptedPayload, "EX", ttlSeconds);
            } else {
                await this.publisher.set(key, encryptedPayload);
            }

            // Notify subscriber processes of the change (Pub/Sub)
            await this.publisher.publish(key, "updated");

            cacheOperationsTotal.inc({operation: "set", result: "success"});

            this.logger.info(`Redis secure write & publish successful for key: ${key}`);
        } catch (err: any) {
            cacheOperationsTotal.inc({operation: "set", result: "error"});

            this.logger.error(`Redis secure write failed for key ${key}: ${err.message}`);
        }
    }

    /**
     * Removes a key from Redis.
     */
    async del(key: string): Promise<void> {
        try {
            if (!this.isConnected() || !this.publisher) {return;}

            await this.publisher.del(key);

            cacheOperationsTotal.inc({operation: "del", result: "success"});
        } catch (err: any) {
            cacheOperationsTotal.inc({operation: "del", result: "error"});

            this.logger.error(`Redis delete failed for key ${key}: ${err.message}`);
        }
    }
}
