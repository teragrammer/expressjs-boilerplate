import {__ENV} from "./environment";
import Redis from "ioredis";
import fs from "fs";
import {logger} from "./logger";

let redis: Redis | undefined;
let redisSubClient: Redis | undefined;

if (__ENV.REDIS_HOST == "") {
    redis = undefined;
    redisSubClient = undefined;
} else {
    const CONFIG: any = {
        host: __ENV.REDIS_HOST,
        port: __ENV.REDIS_PORT,
        password: __ENV.REDIS_PASS,
    };

    // set SSL connection support
    if (__ENV.REDIS_TLS) {
        CONFIG.tls = {
            ca: fs.readFileSync(__ENV.REDIS_TLS_CA).toString(),
            cert: fs.readFileSync(__ENV.REDIS_TLS_CERT).toString(),
            key: fs.readFileSync(__ENV.REDIS_TLS_KEY).toString(),
            // Optional for self-signed certs:
            rejectUnauthorized: false,
        };
    }

    redis = new Redis(CONFIG);
    redisSubClient = redis.duplicate();

    redis.on("connect", () => {
        logger.info("🤝 Connected to Redis over TLS ✅");
    });

    redis.on("ready", () => {
        logger.info("Redis ready for commands");
    });

    redis.on("error", (err: any) => {
        logger.info(`Redis connection error ❌, ${err.message}`);
    });

    redis.on("close", () => {
        logger.info("Redis connection closed");
    });

    redis.ping().then(() => logger.info("Redis received PONG")).catch(() => logger.error("Regis PING failed"));
}

export interface DBRedisInterface {
    publisher?: Redis;
    subscriber?: Redis;
}

export const DBRedis: DBRedisInterface = {
    publisher: redis,
    subscriber: redisSubClient,
};