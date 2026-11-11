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
Object.defineProperty(exports, "__esModule", { value: true });
// src/config/redis.spec.ts
const vitest_1 = require("vitest");
const { mockRedis, mockQuit, mockOn, mockReadFileSync, mockLogger, } = vitest_1.vi.hoisted(() => {
    const mockQuit = vitest_1.vi.fn().mockResolvedValue("OK");
    const mockOn = vitest_1.vi.fn();
    /**
     * IMPORTANT:
     * redis.ts calls `new Redis(...)`.
     * Therefore this must behave like a constructor.
     */
    const mockRedis = vitest_1.vi.fn().mockImplementation(function () {
        return {
            quit: mockQuit,
            on: mockOn,
        };
    });
    const mockReadFileSync = vitest_1.vi.fn();
    const mockLogger = {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    };
    return {
        mockRedis,
        mockQuit,
        mockOn,
        mockReadFileSync,
        mockLogger,
    };
});
vitest_1.vi.mock("ioredis", () => ({
    default: mockRedis,
}));
vitest_1.vi.mock("fs", () => ({
    readFileSync: mockReadFileSync,
}));
vitest_1.vi.mock("./logger", () => ({
    logger: mockLogger,
}));
function mockEnvironment(overrides = {}) {
    vitest_1.vi.doMock("./environment", () => ({
        __ENV: Object.assign({ REDIS_HOST: "localhost", REDIS_PORT: 6379, REDIS_PASS: "redis-password", REDIS_TLS: false, REDIS_TLS_CA: "", REDIS_TLS_CERT: "", REDIS_TLS_KEY: "", NODE_ENV: "test" }, overrides),
    }));
}
/**
 * Every redis.ts import must happen AFTER the environment mock.
 *
 * redis.ts contains:
 *
 *   const manager = new RedisConnectionManager();
 *
 * so importing the module executes Redis initialization immediately.
 */
function importRedisModule() {
    return __awaiter(this, arguments, void 0, function* (environment = {}) {
        vitest_1.vi.resetModules();
        mockEnvironment(environment);
        return Promise.resolve().then(() => __importStar(require("./redis")));
    });
}
(0, vitest_1.describe)("Redis configuration", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockRedis.mockImplementation(function () {
            return {
                quit: mockQuit,
                on: mockOn,
            };
        });
        mockQuit.mockResolvedValue("OK");
        mockReadFileSync.mockImplementation((path) => Buffer.from(`certificate:${path}`));
    });
    (0, vitest_1.describe)("buildRedisConfig", () => {
        (0, vitest_1.it)("returns null when Redis host is not configured", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_HOST: "",
            });
            (0, vitest_1.expect)(buildRedisConfig()).toBeNull();
            (0, vitest_1.expect)(mockLogger.warn).toHaveBeenCalledWith("Redis host is empty. Redis client will not be initialized.");
        }));
        (0, vitest_1.it)("uses the configured Redis host and port", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_HOST: "redis.example.com",
                REDIS_PORT: 6380,
            });
            (0, vitest_1.expect)(buildRedisConfig()).toMatchObject({
                host: "redis.example.com",
                port: 6380,
            });
        }));
        (0, vitest_1.it)("uses port 6379 when the configured port is invalid", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_PORT: "invalid-port",
            });
            (0, vitest_1.expect)(buildRedisConfig()).toMatchObject({
                host: "localhost",
                port: 6379,
            });
        }));
        (0, vitest_1.it)("uses port 6379 when the configured port is zero", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_PORT: 0,
            });
            (0, vitest_1.expect)(buildRedisConfig()).toMatchObject({
                host: "localhost",
                port: 6379,
            });
        }));
        (0, vitest_1.it)("uses port 6379 when the configured port is empty", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_PORT: "",
            });
            (0, vitest_1.expect)(buildRedisConfig()).toMatchObject({
                host: "localhost",
                port: 6379,
            });
        }));
        (0, vitest_1.it)("includes the Redis password when configured", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_PASS: "super-secret",
            });
            (0, vitest_1.expect)(buildRedisConfig()).toMatchObject({
                password: "super-secret",
            });
        }));
        (0, vitest_1.it)("sets password to undefined when no password is configured", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_PASS: "",
            });
            (0, vitest_1.expect)(buildRedisConfig()).toMatchObject({
                password: undefined,
            });
        }));
        (0, vitest_1.it)("configures maxRetriesPerRequest", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule();
            (0, vitest_1.expect)(buildRedisConfig()).toMatchObject({
                maxRetriesPerRequest: 3,
            });
        }));
        (0, vitest_1.it)("configures the retry strategy", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule();
            const config = buildRedisConfig();
            (0, vitest_1.expect)(config).not.toBeNull();
            (0, vitest_1.expect)(config === null || config === void 0 ? void 0 : config.retryStrategy).toBeDefined();
            const retryStrategy = config.retryStrategy;
            (0, vitest_1.expect)(retryStrategy(1)).toBe(50);
            (0, vitest_1.expect)(retryStrategy(2)).toBe(100);
            (0, vitest_1.expect)(retryStrategy(10)).toBe(500);
            (0, vitest_1.expect)(retryStrategy(40)).toBe(2000);
            (0, vitest_1.expect)(retryStrategy(100)).toBe(2000);
        }));
        (0, vitest_1.it)("configures TLS when REDIS_TLS is enabled", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_TLS: true,
                REDIS_TLS_CA: "/certs/ca.pem",
                REDIS_TLS_CERT: "/certs/client.crt",
                REDIS_TLS_KEY: "/certs/client.key",
                NODE_ENV: "production",
            });
            /**
             * redis.ts creates the module-level manager during import.
             * Because Redis TLS is enabled, that import itself calls
             * readFileSync three times.
             *
             * Clear the calls after module initialization so that
             * this test measures ONLY buildRedisConfig().
             */
            mockReadFileSync.mockClear();
            const config = buildRedisConfig();
            (0, vitest_1.expect)(config === null || config === void 0 ? void 0 : config.tls).toEqual({
                ca: "certificate:/certs/ca.pem",
                cert: "certificate:/certs/client.crt",
                key: "certificate:/certs/client.key",
                rejectUnauthorized: true,
            });
            (0, vitest_1.expect)(mockReadFileSync).toHaveBeenCalledTimes(3);
            (0, vitest_1.expect)(mockReadFileSync).toHaveBeenNthCalledWith(1, "/certs/ca.pem");
            (0, vitest_1.expect)(mockReadFileSync).toHaveBeenNthCalledWith(2, "/certs/client.crt");
            (0, vitest_1.expect)(mockReadFileSync).toHaveBeenNthCalledWith(3, "/certs/client.key");
        }));
        (0, vitest_1.it)("disables TLS certificate verification outside production", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_TLS: true,
                REDIS_TLS_CA: "/certs/ca.pem",
                REDIS_TLS_CERT: "/certs/client.crt",
                REDIS_TLS_KEY: "/certs/client.key",
                NODE_ENV: "test",
            });
            mockReadFileSync.mockClear();
            const config = buildRedisConfig();
            (0, vitest_1.expect)(config === null || config === void 0 ? void 0 : config.tls).toMatchObject({
                rejectUnauthorized: false,
            });
            (0, vitest_1.expect)(mockReadFileSync).toHaveBeenCalledTimes(3);
        }));
        (0, vitest_1.it)("throws when TLS certificates cannot be loaded", () => __awaiter(void 0, void 0, void 0, function* () {
            /**
             * Import with TLS disabled first so that the module-level
             * RedisConnectionManager does not consume the failing mock.
             */
            mockReadFileSync.mockClear();
            mockReadFileSync.mockImplementationOnce(() => {
                throw new Error("Certificate file not found");
            });
            /**
             * We cannot change __ENV after the module has been imported.
             *
             * Instead, this test needs a fresh module with TLS enabled.
             */
            vitest_1.vi.resetModules();
            mockEnvironment({
                REDIS_TLS: true,
                REDIS_TLS_CA: "/certs/ca.pem",
                REDIS_TLS_CERT: "/certs/client.crt",
                REDIS_TLS_KEY: "/certs/client.key",
                NODE_ENV: "test",
            });
            /**
             * The failure occurs during module-level manager
             * initialization, and RedisConnectionManager catches it.
             * Therefore buildRedisConfig itself must be tested in a
             * module where manager initialization doesn't consume
             * the failing fs call.
             *
             * Use successful reads for module initialization.
             */
            mockReadFileSync
                .mockReset()
                .mockImplementation((path) => Buffer.from(`certificate:${path}`));
            const redisModule = yield Promise.resolve().then(() => __importStar(require("./redis")));
            mockReadFileSync.mockReset();
            mockReadFileSync.mockImplementationOnce(() => {
                throw new Error("Certificate file not found");
            });
            (0, vitest_1.expect)(() => {
                redisModule.buildRedisConfig();
            }).toThrow("Redis TLS initialization failed: Certificate file not found");
            (0, vitest_1.expect)(mockLogger.error).toHaveBeenCalledWith("CRITICAL: Failed to load TLS certificates for Redis: Certificate file not found");
        }));
        (0, vitest_1.it)("omits TLS configuration when REDIS_TLS is disabled", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildRedisConfig } = yield importRedisModule({
                REDIS_TLS: false,
            });
            const config = buildRedisConfig();
            (0, vitest_1.expect)(config).not.toBeNull();
            (0, vitest_1.expect)(config).not.toHaveProperty("tls");
            (0, vitest_1.expect)(mockReadFileSync).not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("RedisConnectionManager", () => {
        (0, vitest_1.it)("creates publisher and subscriber clients", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            /**
             * One manager was already created at module import time.
             * Clear constructor calls before testing our explicit manager.
             */
            mockRedis.mockClear();
            mockOn.mockClear();
            const manager = new RedisConnectionManager();
            (0, vitest_1.expect)(mockRedis).toHaveBeenCalledTimes(2);
            (0, vitest_1.expect)(mockRedis).toHaveBeenNthCalledWith(1, vitest_1.expect.objectContaining({
                host: "localhost",
                port: 6379,
                password: "redis-password",
                maxRetriesPerRequest: 3,
            }));
            (0, vitest_1.expect)(mockRedis).toHaveBeenNthCalledWith(2, vitest_1.expect.objectContaining({
                host: "localhost",
                port: 6379,
                password: "redis-password",
                maxRetriesPerRequest: 3,
                disableClientInfo: true,
            }));
            const clients = manager.getClients();
            (0, vitest_1.expect)(clients.publisher).toBeDefined();
            (0, vitest_1.expect)(clients.subscriber).toBeDefined();
        }));
        (0, vitest_1.it)("does not create clients when Redis host is unavailable", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule({
                REDIS_HOST: "",
            });
            mockRedis.mockClear();
            const manager = new RedisConnectionManager();
            (0, vitest_1.expect)(mockRedis).not.toHaveBeenCalled();
            (0, vitest_1.expect)(manager.getClients()).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });
        }));
        (0, vitest_1.it)("registers all event listeners", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockRedis.mockClear();
            mockOn.mockClear();
            new RedisConnectionManager();
            (0, vitest_1.expect)(mockOn).toHaveBeenCalledTimes(8);
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(1, "connect", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(2, "ready", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(3, "error", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(4, "close", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(5, "connect", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(6, "ready", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(7, "error", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(mockOn).toHaveBeenNthCalledWith(8, "close", vitest_1.expect.any(Function));
        }));
        (0, vitest_1.it)("logs publisher connect event", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.info.mockClear();
            new RedisConnectionManager();
            const connectHandler = mockOn.mock.calls[0][1];
            connectHandler();
            (0, vitest_1.expect)(mockLogger.info).toHaveBeenCalledWith("🤝 Publisher connected to Redis ✅");
        }));
        (0, vitest_1.it)("logs subscriber connect event", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.info.mockClear();
            new RedisConnectionManager();
            const connectHandler = mockOn.mock.calls[4][1];
            connectHandler();
            (0, vitest_1.expect)(mockLogger.info).toHaveBeenCalledWith("🤝 Subscriber connected to Redis ✅");
        }));
        (0, vitest_1.it)("logs publisher ready event", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.info.mockClear();
            new RedisConnectionManager();
            const readyHandler = mockOn.mock.calls[1][1];
            readyHandler();
            (0, vitest_1.expect)(mockLogger.info).toHaveBeenCalledWith("Publisher is ready for commands");
        }));
        (0, vitest_1.it)("logs subscriber ready event", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.info.mockClear();
            new RedisConnectionManager();
            const readyHandler = mockOn.mock.calls[5][1];
            readyHandler();
            (0, vitest_1.expect)(mockLogger.info).toHaveBeenCalledWith("Subscriber is ready for commands");
        }));
        (0, vitest_1.it)("logs publisher connection errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.error.mockClear();
            new RedisConnectionManager();
            const errorHandler = mockOn.mock.calls[2][1];
            errorHandler(new Error("Connection refused"));
            (0, vitest_1.expect)(mockLogger.error).toHaveBeenCalledWith("Publisher connection error: Connection refused");
        }));
        (0, vitest_1.it)("logs subscriber connection errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.error.mockClear();
            new RedisConnectionManager();
            const errorHandler = mockOn.mock.calls[6][1];
            errorHandler(new Error("Authentication failed"));
            (0, vitest_1.expect)(mockLogger.error).toHaveBeenCalledWith("Subscriber connection error: Authentication failed");
        }));
        (0, vitest_1.it)("logs publisher close event", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.warn.mockClear();
            new RedisConnectionManager();
            const closeHandler = mockOn.mock.calls[3][1];
            closeHandler();
            (0, vitest_1.expect)(mockLogger.warn).toHaveBeenCalledWith("Publisher connection closed");
        }));
        (0, vitest_1.it)("logs subscriber close event", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockOn.mockClear();
            mockLogger.warn.mockClear();
            new RedisConnectionManager();
            const closeHandler = mockOn.mock.calls[7][1];
            closeHandler();
            (0, vitest_1.expect)(mockLogger.warn).toHaveBeenCalledWith("Subscriber connection closed");
        }));
        (0, vitest_1.it)("returns the publisher and subscriber clients", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            const publisher = {
                quit: vitest_1.vi.fn().mockResolvedValue("OK"),
                on: vitest_1.vi.fn(),
            };
            const subscriber = {
                quit: vitest_1.vi.fn().mockResolvedValue("OK"),
                on: vitest_1.vi.fn(),
            };
            /**
             * Because Redis is invoked with `new`, use
             * mockImplementation rather than mockReturnValueOnce.
             */
            let callCount = 0;
            mockRedis.mockImplementation(function () {
                callCount++;
                return callCount === 1
                    ? publisher
                    : subscriber;
            });
            const manager = new RedisConnectionManager();
            (0, vitest_1.expect)(manager.getClients().publisher).toBe(publisher);
            (0, vitest_1.expect)(manager.getClients().subscriber).toBe(subscriber);
        }));
        (0, vitest_1.it)("disconnects both clients", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            const publisherQuit = vitest_1.vi.fn().mockResolvedValue("OK");
            const subscriberQuit = vitest_1.vi.fn().mockResolvedValue("OK");
            let callCount = 0;
            mockRedis.mockImplementation(function () {
                callCount++;
                return {
                    quit: callCount === 1
                        ? publisherQuit
                        : subscriberQuit,
                    on: vitest_1.vi.fn(),
                };
            });
            const manager = new RedisConnectionManager();
            yield (0, vitest_1.expect)(manager.disconnectAll()).resolves.toBeUndefined();
            (0, vitest_1.expect)(publisherQuit).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(subscriberQuit).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockLogger.info).toHaveBeenCalledWith("All Redis connections shut down cleanly.");
        }));
        (0, vitest_1.it)("disconnects successfully when clients exist", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            const publisherQuit = vitest_1.vi.fn().mockResolvedValue("OK");
            const subscriberQuit = vitest_1.vi.fn().mockResolvedValue("OK");
            let callCount = 0;
            mockRedis.mockImplementation(function () {
                callCount++;
                return {
                    quit: callCount === 1
                        ? publisherQuit
                        : subscriberQuit,
                    on: vitest_1.vi.fn(),
                };
            });
            const manager = new RedisConnectionManager();
            yield manager.disconnectAll();
            (0, vitest_1.expect)(publisherQuit).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(subscriberQuit).toHaveBeenCalledTimes(1);
        }));
        (0, vitest_1.it)("disconnects safely when Redis clients do not exist", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule({
                REDIS_HOST: "",
            });
            const manager = new RedisConnectionManager();
            yield (0, vitest_1.expect)(manager.disconnectAll()).resolves.toBeUndefined();
            (0, vitest_1.expect)(mockLogger.info).toHaveBeenCalledWith("All Redis connections shut down cleanly.");
        }));
        (0, vitest_1.it)("handles Redis client initialization errors", () => __awaiter(void 0, void 0, void 0, function* () {
            /**
             * Import normally first.
             */
            const { RedisConnectionManager, } = yield importRedisModule();
            /**
             * Redis is called with `new`, therefore throw using
             * mockImplementation instead of mockReturnValueOnce.
             */
            mockRedis.mockImplementation(function () {
                throw new Error("Unable to create Redis client");
            });
            mockLogger.error.mockClear();
            const manager = new RedisConnectionManager();
            (0, vitest_1.expect)(manager.getClients()).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });
            (0, vitest_1.expect)(mockLogger.error).toHaveBeenCalledWith("Failed to boot Redis Manager clients: Unable to create Redis client");
        }));
        (0, vitest_1.it)("handles non-Error Redis initialization failures", () => __awaiter(void 0, void 0, void 0, function* () {
            const { RedisConnectionManager, } = yield importRedisModule();
            mockRedis.mockImplementation(function () {
                throw "Redis initialization failed";
            });
            mockLogger.error.mockClear();
            const manager = new RedisConnectionManager();
            (0, vitest_1.expect)(manager.getClients()).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });
            (0, vitest_1.expect)(mockLogger.error).toHaveBeenCalledWith("Failed to boot Redis Manager clients: Redis initialization failed");
        }));
    });
    (0, vitest_1.describe)("module exports", () => {
        (0, vitest_1.it)("initializes DBRedis from the module-level manager", () => __awaiter(void 0, void 0, void 0, function* () {
            const { DBRedis } = yield importRedisModule();
            (0, vitest_1.expect)(DBRedis.publisher).toBeDefined();
            (0, vitest_1.expect)(DBRedis.subscriber).toBeDefined();
        }));
        (0, vitest_1.it)("exposes disconnectRedis", () => __awaiter(void 0, void 0, void 0, function* () {
            const { disconnectRedis, } = yield importRedisModule();
            mockQuit.mockClear();
            yield (0, vitest_1.expect)(disconnectRedis()).resolves.toBeUndefined();
            (0, vitest_1.expect)(mockQuit).toHaveBeenCalledTimes(2);
        }));
        (0, vitest_1.it)("exposes undefined clients when Redis is disabled", () => __awaiter(void 0, void 0, void 0, function* () {
            const { DBRedis } = yield importRedisModule({
                REDIS_HOST: "",
            });
            (0, vitest_1.expect)(DBRedis).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });
        }));
    });
});
