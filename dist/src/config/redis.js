"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.disconnectRedis = exports.DBRedis = exports.RedisConnectionManager = void 0;
exports.buildRedisConfig = buildRedisConfig;
// src/config/redis.ts
const ioredis_1 = __importDefault(require("ioredis"));
const fs = __importStar(require("fs"));
const environment_1 = require("./environment");
const logger_1 = require("./logger");
/**
 * Generates secure, robust configurations for Redis clients.
 */
function buildRedisConfig() {
    if (!environment_1.__ENV.REDIS_HOST) {
        logger_1.logger.warn("Redis host is empty. Redis client will not be initialized.");
        return null;
    }
    const config = {
        host: environment_1.__ENV.REDIS_HOST,
        port: Number(environment_1.__ENV.REDIS_PORT) || 6379,
        password: environment_1.__ENV.REDIS_PASS || undefined,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
            return Math.min(times * 50, 2000);
        },
    };
    if (environment_1.__ENV.REDIS_TLS) {
        try {
            config.tls = {
                ca: fs.readFileSync(environment_1.__ENV.REDIS_TLS_CA).toString(),
                cert: fs.readFileSync(environment_1.__ENV.REDIS_TLS_CERT).toString(),
                key: fs.readFileSync(environment_1.__ENV.REDIS_TLS_KEY).toString(),
                rejectUnauthorized: environment_1.__ENV.NODE_ENV === "production",
            };
        }
        catch (error) {
            logger_1.logger.error(`CRITICAL: Failed to load TLS certificates for Redis: ${error.message}`);
            throw new Error(`Redis TLS initialization failed: ${error.message}`, { cause: error });
        }
    }
    return config;
}
/**
 * Managed Redis clients container.
 */
class RedisConnectionManager {
    constructor() {
        this.initializeClients();
    }
    initializeClients() {
        try {
            const baseConfig = buildRedisConfig();
            if (!baseConfig) {
                return;
            }
            // 1. Standard Publisher config
            this.publisherClient = new ioredis_1.default(baseConfig);
            // 2. Subscriber config: We MUST disable background handshake queries
            // to prevent the subscriber socket from attempting to execute "CLIENT INFO"
            this.subscriberClient = new ioredis_1.default(Object.assign(Object.assign({}, baseConfig), { disableClientInfo: true // ⚡️ This stops the background client info errors!
             }));
            this.setupEventListeners(this.publisherClient, "Publisher");
            this.setupEventListeners(this.subscriberClient, "Subscriber");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger_1.logger.error(`Failed to boot Redis Manager clients: ${message}`);
        }
    }
    setupEventListeners(client, label) {
        client.on("connect", () => {
            logger_1.logger.info(`🤝 ${label} connected to Redis ✅`);
        });
        client.on("ready", () => {
            logger_1.logger.info(`${label} is ready for commands`);
        });
        client.on("error", (err) => {
            logger_1.logger.error(`${label} connection error: ${err.message}`);
        });
        client.on("close", () => {
            logger_1.logger.warn(`${label} connection closed`);
        });
    }
    getClients() {
        return {
            publisher: this.publisherClient,
            subscriber: this.subscriberClient,
        };
    }
    disconnectAll() {
        return __awaiter(this, void 0, void 0, function* () {
            const promises = [];
            if (this.publisherClient) {
                promises.push(this.publisherClient.quit());
            }
            if (this.subscriberClient) {
                promises.push(this.subscriberClient.quit());
            }
            yield Promise.all(promises);
            logger_1.logger.info("All Redis connections shut down cleanly.");
        });
    }
}
exports.RedisConnectionManager = RedisConnectionManager;
const manager = new RedisConnectionManager();
exports.DBRedis = manager.getClients();
const disconnectRedis = () => manager.disconnectAll();
exports.disconnectRedis = disconnectRedis;
