// src/shared/redis/redis-cache.ts
import {DBRedisInterface} from "../../config/redis";
import Redis from "ioredis";
import {SecurityUtil} from "../../common/utils/security.util";

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
            if (!securedData) {return null;}

            const decryptedData = await this.securityUtil.unshield(securedData);
            return JSON.parse(decryptedData) as T;
        } catch (err: any) {
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

            this.logger.info(`Redis secure write & publish successful for key: ${key}`);
        } catch (err: any) {
            this.logger.error(`Redis secure write failed for key ${key}: ${err.message}`);
        }
    }
}