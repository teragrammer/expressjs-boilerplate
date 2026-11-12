// src/config/redis.spec.ts
import {beforeEach, describe, expect, it, vi} from "vitest";

const {
    mockRedis,
    mockQuit,
    mockOn,
    mockReadFileSync,
    mockLogger,
} = vi.hoisted(() => {
    const mockQuit = vi.fn().mockResolvedValue("OK");
    const mockOn = vi.fn();

    /**
     * IMPORTANT:
     * redis.ts calls `new Redis(...)`.
     * Therefore this must behave like a constructor.
     */
    const mockRedis = vi.fn().mockImplementation(function () {
        return {
            quit: mockQuit,
            on: mockOn,
        };
    });

    const mockReadFileSync = vi.fn();

    const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

    return {
        mockRedis,
        mockQuit,
        mockOn,
        mockReadFileSync,
        mockLogger,
    };
});

vi.mock("ioredis", () => ({
    default: mockRedis,
}));

vi.mock("fs", () => ({
    readFileSync: mockReadFileSync,
}));

vi.mock("./logger", () => ({
    logger: mockLogger,
}));

type RedisEnvironment = {
    REDIS_HOST?: string;
    REDIS_PORT?: number | string;
    REDIS_PASS?: string;
    REDIS_TLS?: boolean;
    REDIS_TLS_CA?: string;
    REDIS_TLS_CERT?: string;
    REDIS_TLS_KEY?: string;
    NODE_ENV?: string;
};

function mockEnvironment(
    overrides: RedisEnvironment = {},
): void {
    vi.doMock("./environment", () => ({
        __ENV: {
            REDIS_HOST: "localhost",
            REDIS_PORT: 6379,
            REDIS_PASS: "redis-password",
            REDIS_TLS: false,
            REDIS_TLS_CA: "",
            REDIS_TLS_CERT: "",
            REDIS_TLS_KEY: "",
            NODE_ENV: "test",
            ...overrides,
        },
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
async function importRedisModule(
    environment: RedisEnvironment = {},
) {
    vi.resetModules();

    mockEnvironment(environment);

    return import("./redis");
}

describe("Redis configuration", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockRedis.mockImplementation(function () {
            return {
                quit: mockQuit,
                on: mockOn,
            };
        });

        mockQuit.mockResolvedValue("OK");

        mockReadFileSync.mockImplementation(
            (path: string) =>
                Buffer.from(`certificate:${path}`),
        );
    });

    describe("buildRedisConfig", () => {
        it("returns null when Redis host is not configured", async () => {
            const {buildRedisConfig} = await importRedisModule({
                REDIS_HOST: "",
            });

            expect(buildRedisConfig()).toBeNull();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                "Redis host is empty. Redis client will not be initialized.",
            );
        });

        it("uses the configured Redis host and port", async () => {
            const {buildRedisConfig} = await importRedisModule({
                REDIS_HOST: "redis.example.com",
                REDIS_PORT: 6380,
            });

            expect(buildRedisConfig()).toMatchObject({
                host: "redis.example.com",
                port: 6380,
            });
        });

        it("uses port 6379 when the configured port is invalid", async () => {
            const {buildRedisConfig} = await importRedisModule({
                REDIS_PORT: "invalid-port",
            });

            expect(buildRedisConfig()).toMatchObject({
                host: "localhost",
                port: 6379,
            });
        });

        it("uses port 6379 when the configured port is zero", async () => {
            const {buildRedisConfig} = await importRedisModule({
                REDIS_PORT: 0,
            });

            expect(buildRedisConfig()).toMatchObject({
                host: "localhost",
                port: 6379,
            });
        });

        it("uses port 6379 when the configured port is empty", async () => {
            const {buildRedisConfig} = await importRedisModule({
                REDIS_PORT: "",
            });

            expect(buildRedisConfig()).toMatchObject({
                host: "localhost",
                port: 6379,
            });
        });

        it("includes the Redis password when configured", async () => {
            const {buildRedisConfig} = await importRedisModule({
                REDIS_PASS: "super-secret",
            });

            expect(buildRedisConfig()).toMatchObject({
                password: "super-secret",
            });
        });

        it("sets password to undefined when no password is configured", async () => {
            const {buildRedisConfig} = await importRedisModule({
                REDIS_PASS: "",
            });

            expect(buildRedisConfig()).toMatchObject({
                password: undefined,
            });
        });

        it("configures maxRetriesPerRequest", async () => {
            const {buildRedisConfig} =
                await importRedisModule();

            expect(buildRedisConfig()).toMatchObject({
                maxRetriesPerRequest: 3,
            });
        });

        it("configures the retry strategy", async () => {
            const {buildRedisConfig} =
                await importRedisModule();

            const config = buildRedisConfig();

            expect(config).not.toBeNull();
            expect(config?.retryStrategy).toBeDefined();

            const retryStrategy = config!.retryStrategy!;

            expect(retryStrategy(1)).toBe(50);
            expect(retryStrategy(2)).toBe(100);
            expect(retryStrategy(10)).toBe(500);
            expect(retryStrategy(40)).toBe(2000);
            expect(retryStrategy(100)).toBe(2000);
        });

        it("configures TLS when REDIS_TLS is enabled", async () => {
            const {buildRedisConfig} =
                await importRedisModule({
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

            expect(config?.tls).toEqual({
                ca: "certificate:/certs/ca.pem",
                cert: "certificate:/certs/client.crt",
                key: "certificate:/certs/client.key",
                rejectUnauthorized: true,
            });

            expect(mockReadFileSync).toHaveBeenCalledTimes(3);

            expect(mockReadFileSync).toHaveBeenNthCalledWith(
                1,
                "/certs/ca.pem",
            );

            expect(mockReadFileSync).toHaveBeenNthCalledWith(
                2,
                "/certs/client.crt",
            );

            expect(mockReadFileSync).toHaveBeenNthCalledWith(
                3,
                "/certs/client.key",
            );
        });

        it("verifies TLS certificates in every environment", async () => {
            const {buildRedisConfig} =
                await importRedisModule({
                    REDIS_TLS: true,
                    REDIS_TLS_CA: "/certs/ca.pem",
                    REDIS_TLS_CERT: "/certs/client.crt",
                    REDIS_TLS_KEY: "/certs/client.key",
                    NODE_ENV: "test",
                });

            mockReadFileSync.mockClear();

            const config = buildRedisConfig();

            expect(config?.tls).toEqual({
                ca: "certificate:/certs/ca.pem",
                cert: "certificate:/certs/client.crt",
                key: "certificate:/certs/client.key",
                rejectUnauthorized: true,
            });

            expect(mockReadFileSync).toHaveBeenCalledTimes(3);
        });

        it("supports CA-only TLS without a client certificate", async () => {
            const {buildRedisConfig} =
                await importRedisModule({
                    REDIS_TLS: true,
                    REDIS_TLS_CA: "/certs/ca.pem",
                    REDIS_TLS_CERT: "",
                    REDIS_TLS_KEY: "",
                });

            mockReadFileSync.mockClear();

            const config = buildRedisConfig();

            expect(config?.tls).toEqual({
                ca: "certificate:/certs/ca.pem",
                cert: undefined,
                key: undefined,
                rejectUnauthorized: true,
            });

            expect(mockReadFileSync).toHaveBeenCalledTimes(1);
        });

        it("refuses a client certificate without a matching key", async () => {
            const {buildRedisConfig} =
                await importRedisModule({
                    REDIS_TLS: true,
                    REDIS_TLS_CERT: "/certs/client.crt",
                    REDIS_TLS_KEY: "",
                });

            expect(() => buildRedisConfig()).toThrow(
                "Redis TLS initialization failed: " +
                "REDIS_TLS_CERT and REDIS_TLS_KEY must be configured together",
            );
        });

        it("refuses a client key without a matching certificate", async () => {
            const {buildRedisConfig} =
                await importRedisModule({
                    REDIS_TLS: true,
                    REDIS_TLS_CERT: "",
                    REDIS_TLS_KEY: "/certs/client.key",
                });

            expect(() => buildRedisConfig()).toThrow(
                "Redis TLS initialization failed: " +
                "REDIS_TLS_CERT and REDIS_TLS_KEY must be configured together",
            );
        });

        it("throws when TLS certificates cannot be loaded", async () => {
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
            vi.resetModules();

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
                .mockImplementation(
                    (path: string) =>
                        Buffer.from(`certificate:${path}`),
                );

            const redisModule = await import("./redis");

            mockReadFileSync.mockReset();

            mockReadFileSync.mockImplementationOnce(() => {
                throw new Error("Certificate file not found");
            });

            expect(() => {
                redisModule.buildRedisConfig();
            }).toThrow(
                "Redis TLS initialization failed: Certificate file not found",
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                "CRITICAL: Failed to load TLS certificates for Redis: Certificate file not found",
            );
        });

        it("omits TLS configuration when REDIS_TLS is disabled", async () => {
            const {buildRedisConfig} =
                await importRedisModule({
                    REDIS_TLS: false,
                });

            const config = buildRedisConfig();

            expect(config).not.toBeNull();
            expect(config).not.toHaveProperty("tls");
            expect(mockReadFileSync).not.toHaveBeenCalled();
        });
    });

    describe("RedisConnectionManager", () => {
        it("creates publisher and subscriber clients", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            /**
             * One manager was already created at module import time.
             * Clear constructor calls before testing our explicit manager.
             */
            mockRedis.mockClear();
            mockOn.mockClear();

            const manager =
                new RedisConnectionManager();

            expect(mockRedis).toHaveBeenCalledTimes(2);

            expect(mockRedis).toHaveBeenNthCalledWith(
                1,
                expect.objectContaining({
                    host: "localhost",
                    port: 6379,
                    password: "redis-password",
                    maxRetriesPerRequest: 3,
                }),
            );

            expect(mockRedis).toHaveBeenNthCalledWith(
                2,
                expect.objectContaining({
                    host: "localhost",
                    port: 6379,
                    password: "redis-password",
                    maxRetriesPerRequest: 3,
                    disableClientInfo: true,
                }),
            );

            const clients = manager.getClients();

            expect(clients.publisher).toBeDefined();
            expect(clients.subscriber).toBeDefined();
        });

        it("does not create clients when Redis host is unavailable", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule({
                REDIS_HOST: "",
            });

            mockRedis.mockClear();

            const manager =
                new RedisConnectionManager();

            expect(mockRedis).not.toHaveBeenCalled();

            expect(manager.getClients()).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });
        });

        it("registers all event listeners", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockRedis.mockClear();
            mockOn.mockClear();

            new RedisConnectionManager();

            expect(mockOn).toHaveBeenCalledTimes(8);

            expect(mockOn).toHaveBeenNthCalledWith(
                1,
                "connect",
                expect.any(Function),
            );

            expect(mockOn).toHaveBeenNthCalledWith(
                2,
                "ready",
                expect.any(Function),
            );

            expect(mockOn).toHaveBeenNthCalledWith(
                3,
                "error",
                expect.any(Function),
            );

            expect(mockOn).toHaveBeenNthCalledWith(
                4,
                "close",
                expect.any(Function),
            );

            expect(mockOn).toHaveBeenNthCalledWith(
                5,
                "connect",
                expect.any(Function),
            );

            expect(mockOn).toHaveBeenNthCalledWith(
                6,
                "ready",
                expect.any(Function),
            );

            expect(mockOn).toHaveBeenNthCalledWith(
                7,
                "error",
                expect.any(Function),
            );

            expect(mockOn).toHaveBeenNthCalledWith(
                8,
                "close",
                expect.any(Function),
            );
        });

        it("logs publisher connect event", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.info.mockClear();

            new RedisConnectionManager();

            const connectHandler =
                mockOn.mock.calls[0][1];

            connectHandler();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "🤝 Publisher connected to Redis ✅",
            );
        });

        it("logs subscriber connect event", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.info.mockClear();

            new RedisConnectionManager();

            const connectHandler =
                mockOn.mock.calls[4][1];

            connectHandler();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "🤝 Subscriber connected to Redis ✅",
            );
        });

        it("logs publisher ready event", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.info.mockClear();

            new RedisConnectionManager();

            const readyHandler =
                mockOn.mock.calls[1][1];

            readyHandler();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Publisher is ready for commands",
            );
        });

        it("logs subscriber ready event", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.info.mockClear();

            new RedisConnectionManager();

            const readyHandler =
                mockOn.mock.calls[5][1];

            readyHandler();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "Subscriber is ready for commands",
            );
        });

        it("logs publisher connection errors", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.error.mockClear();

            new RedisConnectionManager();

            const errorHandler =
                mockOn.mock.calls[2][1];

            errorHandler(
                new Error("Connection refused"),
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Publisher connection error: Connection refused",
            );
        });

        it("logs subscriber connection errors", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.error.mockClear();

            new RedisConnectionManager();

            const errorHandler =
                mockOn.mock.calls[6][1];

            errorHandler(
                new Error("Authentication failed"),
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Subscriber connection error: Authentication failed",
            );
        });

        it("logs publisher close event", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.warn.mockClear();

            new RedisConnectionManager();

            const closeHandler =
                mockOn.mock.calls[3][1];

            closeHandler();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                "Publisher connection closed",
            );
        });

        it("logs subscriber close event", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockOn.mockClear();
            mockLogger.warn.mockClear();

            new RedisConnectionManager();

            const closeHandler =
                mockOn.mock.calls[7][1];

            closeHandler();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                "Subscriber connection closed",
            );
        });

        it("returns the publisher and subscriber clients", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            const publisher = {
                quit: vi.fn().mockResolvedValue("OK"),
                on: vi.fn(),
            };

            const subscriber = {
                quit: vi.fn().mockResolvedValue("OK"),
                on: vi.fn(),
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

            const manager =
                new RedisConnectionManager();

            expect(manager.getClients().publisher).toBe(
                publisher,
            );

            expect(manager.getClients().subscriber).toBe(
                subscriber,
            );
        });

        it("disconnects both clients", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            const publisherQuit =
                vi.fn().mockResolvedValue("OK");

            const subscriberQuit =
                vi.fn().mockResolvedValue("OK");

            let callCount = 0;

            mockRedis.mockImplementation(function () {
                callCount++;

                return {
                    quit:
                        callCount === 1
                            ? publisherQuit
                            : subscriberQuit,
                    on: vi.fn(),
                };
            });

            const manager =
                new RedisConnectionManager();

            await expect(
                manager.disconnectAll(),
            ).resolves.toBeUndefined();

            expect(publisherQuit).toHaveBeenCalledTimes(1);
            expect(subscriberQuit).toHaveBeenCalledTimes(1);

            expect(mockLogger.info).toHaveBeenCalledWith(
                "All Redis connections shut down cleanly.",
            );
        });

        it("disconnects successfully when clients exist", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            const publisherQuit =
                vi.fn().mockResolvedValue("OK");

            const subscriberQuit =
                vi.fn().mockResolvedValue("OK");

            let callCount = 0;

            mockRedis.mockImplementation(function () {
                callCount++;

                return {
                    quit:
                        callCount === 1
                            ? publisherQuit
                            : subscriberQuit,
                    on: vi.fn(),
                };
            });

            const manager =
                new RedisConnectionManager();

            await manager.disconnectAll();

            expect(publisherQuit).toHaveBeenCalledTimes(1);
            expect(subscriberQuit).toHaveBeenCalledTimes(1);
        });

        it("disconnects safely when Redis clients do not exist", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule({
                REDIS_HOST: "",
            });

            const manager =
                new RedisConnectionManager();

            await expect(
                manager.disconnectAll(),
            ).resolves.toBeUndefined();

            expect(mockLogger.info).toHaveBeenCalledWith(
                "All Redis connections shut down cleanly.",
            );
        });

        it("handles Redis client initialization errors", async () => {
            /**
             * Import normally first.
             */
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            /**
             * Redis is called with `new`, therefore throw using
             * mockImplementation instead of mockReturnValueOnce.
             */
            mockRedis.mockImplementation(function () {
                throw new Error(
                    "Unable to create Redis client",
                );
            });

            mockLogger.error.mockClear();

            const manager =
                new RedisConnectionManager();

            expect(manager.getClients()).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Failed to boot Redis Manager clients: Unable to create Redis client",
            );
        });

        it("handles non-Error Redis initialization failures", async () => {
            const {
                RedisConnectionManager,
            } = await importRedisModule();

            mockRedis.mockImplementation(function () {
                throw "Redis initialization failed";
            });

            mockLogger.error.mockClear();

            const manager =
                new RedisConnectionManager();

            expect(manager.getClients()).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Failed to boot Redis Manager clients: Redis initialization failed",
            );
        });
    });

    describe("module exports", () => {
        it("initializes DBRedis from the module-level manager", async () => {
            const {DBRedis} =
                await importRedisModule();

            expect(DBRedis.publisher).toBeDefined();
            expect(DBRedis.subscriber).toBeDefined();
        });

        it("exposes disconnectRedis", async () => {
            const {
                disconnectRedis,
            } = await importRedisModule();

            mockQuit.mockClear();

            await expect(
                disconnectRedis(),
            ).resolves.toBeUndefined();

            expect(mockQuit).toHaveBeenCalledTimes(2);
        });

        it("exposes undefined clients when Redis is disabled", async () => {
            const {DBRedis} =
                await importRedisModule({
                    REDIS_HOST: "",
                });

            expect(DBRedis).toEqual({
                publisher: undefined,
                subscriber: undefined,
            });
        });
    });
});
