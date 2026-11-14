// src/config/redis.ts
import Redis, {RedisOptions} from "ioredis";
import * as fs from "fs";
import type {ConnectionOptions} from "tls";
import {__ENV} from "./environment";
import {logger} from "./logger";

export interface DBRedisInterface {
    publisher?: Redis;
    subscriber?: Redis;
}

/**
 * Generates secure, robust configurations for Redis clients.
 */
export function buildRedisConfig(): RedisOptions | null {
    if (!__ENV.REDIS_HOST) {
        logger.warn("Redis host is empty. Redis client will not be initialized.");
        return null;
    }

    const config: RedisOptions = {
        host: __ENV.REDIS_HOST,
        port: Number(__ENV.REDIS_PORT) || 6379,
        password: __ENV.REDIS_PASS || undefined,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            return Math.min(times * 50, 2000);
        },
    };

    if (__ENV.REDIS_TLS) {
        try {
            const caPath = __ENV.REDIS_TLS_CA;
            const certPath = __ENV.REDIS_TLS_CERT;
            const keyPath = __ENV.REDIS_TLS_KEY;

            if (Boolean(certPath) !== Boolean(keyPath)) {
                throw new Error(
                    "REDIS_TLS_CERT and REDIS_TLS_KEY must be configured together",
                );
            }

            /*
             * Redis encryption is only useful when the server identity is
             * verified. Do not relax this outside production: a staging or
             * development process can still reach a shared Redis instance.
             */
            const tls: ConnectionOptions = {
                rejectUnauthorized: true,
                ca: caPath
                    ? fs.readFileSync(caPath).toString()
                    : undefined,
                cert: certPath
                    ? fs.readFileSync(certPath).toString()
                    : undefined,
                key: keyPath
                    ? fs.readFileSync(keyPath).toString()
                    : undefined,
            };

            /*
             * Node verifies the certificate against the host it dials.
             * When REDIS_HOST is an IP that the certificate does not
             * list, verify against this name instead (SNI is still sent).
             */
            if (__ENV.REDIS_TLS_SERVERNAME) {
                tls.servername = __ENV.REDIS_TLS_SERVERNAME;
            }

            config.tls = tls;
        } catch (error: any) {
            logger.error(`CRITICAL: Failed to load TLS certificates for Redis: ${error.message}`);
            throw new Error(`Redis TLS initialization failed: ${error.message}`, { cause: error });
        }
    }

    return config;
}

/**
 * Managed Redis clients container.
 */
export class RedisConnectionManager {
    private publisherClient?: Redis;
    private subscriberClient?: Redis;

    constructor() {
        this.initializeClients();
    }

    private initializeClients(): void {
        try {
            const baseConfig = buildRedisConfig();
            if (!baseConfig) {return;}

            // 1. Standard Publisher config
            this.publisherClient = new Redis(baseConfig);

            // 2. Subscriber config: We MUST disable background handshake queries
            // to prevent the subscriber socket from attempting to execute "CLIENT INFO"
            this.subscriberClient = new Redis({
                ...baseConfig,
                disableClientInfo: true // ⚡️ This stops the background client info errors!
            });

            this.setupEventListeners(this.publisherClient, "Publisher");
            this.setupEventListeners(this.subscriberClient, "Subscriber");
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`Failed to boot Redis Manager clients: ${message}`);
        }
    }

    private setupEventListeners(client: Redis, label: string): void {
        client.on("connect", () => {
            logger.info(`🤝 ${label} connected to Redis ✅`);
        });

        client.on("ready", () => {
            logger.info(`${label} is ready for commands`);
        });

        client.on("error", (err: Error) => {
            logger.error(`${label} connection error: ${err.message}`);
        });

        client.on("close", () => {
            logger.warn(`${label} connection closed`);
        });
    }

    public getClients(): DBRedisInterface {
        return {
            publisher: this.publisherClient,
            subscriber: this.subscriberClient,
        };
    }

    public async disconnectAll(): Promise<void> {
        const promises: Promise<string>[] = [];
        if (this.publisherClient) {promises.push(this.publisherClient.quit());}
        if (this.subscriberClient) {promises.push(this.subscriberClient.quit());}
        await Promise.all(promises);
        logger.info("All Redis connections shut down cleanly.");
    }
}

const manager = new RedisConnectionManager();
export const DBRedis: DBRedisInterface = manager.getClients();
export const disconnectRedis = () => manager.disconnectAll();