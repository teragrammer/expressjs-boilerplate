// src/config/database.spec.ts
import {beforeEach, describe, expect, it, vi} from "vitest";

const {
    mockPoolConstructor,
    mockPoolOn,
    mockClientQuery,
    mockClientRelease,
    mockPoolConnect,
    mockReadFileSync,
    mockLogger,
} = vi.hoisted(() => {
    const mockPoolOn = vi.fn();
    const mockClientQuery = vi.fn();
    const mockClientRelease = vi.fn();
    const mockPoolConnect = vi.fn().mockImplementation(() =>
        Promise.resolve({
            query: mockClientQuery,
            release: mockClientRelease,
        }),
    );
    // NOTE: must be a `function` (not an arrow) so `new Pool()` works.
    const mockPoolConstructor = vi.fn(function (
        this: unknown,
        ..._args: unknown[]
    ) {
        return {
            on: mockPoolOn,
            connect: mockPoolConnect,
        };
    });
    const mockReadFileSync = vi.fn();
    const mockLogger = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

    return {
        mockPoolConstructor,
        mockPoolOn,
        mockClientQuery,
        mockClientRelease,
        mockPoolConnect,
        mockReadFileSync,
        mockLogger,
    };
});

vi.mock("pg", () => ({
    Pool: mockPoolConstructor,
}));

vi.mock("fs", () => ({
    default: {
        readFileSync: mockReadFileSync,
    },
    readFileSync: mockReadFileSync,
}));

vi.mock("./logger", () => ({
    logger: mockLogger,
}));

type DatabaseEnvironment = {
    DB_HOST?: string;
    DB_PORT?: number | string;
    DB_USER?: string;
    DB_PASS?: string;
    DB_NAME?: string;
    DB_SSL?: boolean;
    DB_SSL_CA?: string;
    DB_SSL_CERT?: string;
    DB_SSL_KEY?: string;
    DB_POOL_MIN?: number | string;
    DB_POOL_MAX?: number | string;
};

function mockEnvironment(
    overrides: DatabaseEnvironment = {},
): void {
    vi.doMock("./environment", () => ({
        __ENV: {
            DB_HOST: "localhost",
            DB_PORT: 5432,
            DB_USER: "postgres",
            DB_PASS: "postgres-password",
            DB_NAME: "application",

            DB_SSL: false,
            DB_SSL_CA: "",
            DB_SSL_CERT: "",
            DB_SSL_KEY: "",

            DB_POOL_MIN: 2,
            DB_POOL_MAX: 10,

            ...overrides,
        },
    }));
}

async function importDatabaseModule(
    environment: DatabaseEnvironment = {},
) {
    vi.resetModules();
    mockEnvironment(environment);
    return import("./database");
}

describe("Database configuration", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockPoolConstructor.mockImplementation(function (
            this: unknown,
            ..._args: unknown[]
        ) {
            return {
                on: mockPoolOn,
                connect: mockPoolConnect,
            };
        } as never);

        mockPoolConnect.mockImplementation(() =>
            Promise.resolve({
                query: mockClientQuery,
                release: mockClientRelease,
            }),
        );

        mockClientQuery.mockResolvedValue({
            command: "SELECT",
            rowCount: 1,
            rows: [{result: 2}],
        });

        mockReadFileSync.mockImplementation(
            (path: string) => `certificate:${path}`,
        );
    });

    describe("buildPoolConfig", () => {
        it("uses the configured connection properties", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_HOST: "db.example.com",
                DB_PORT: "5433",
                DB_USER: "application-user",
                DB_PASS: "super-secret",
                DB_NAME: "production",
            });

            const config = buildPoolConfig();

            expect(config).toMatchObject({
                host: "db.example.com",
                port: 5433,
                user: "application-user",
                password: "super-secret",
                database: "production",
            });
        });

        it("converts the database port to a number", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_PORT: "5433",
            });

            const config = buildPoolConfig();

            expect(config.port).toBe(5433);
            expect(typeof config.port).toBe("number");
        });

        it("supports a numeric database port", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_PORT: 5432,
            });

            expect(buildPoolConfig().port).toBe(5432);
        });

        it("does not configure TLS when DB_SSL is false", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_SSL: false,
            });

            mockReadFileSync.mockClear();

            const config = buildPoolConfig();

            expect(config).not.toHaveProperty("ssl");
            expect(mockReadFileSync).not.toHaveBeenCalled();
        });

        it("does not configure TLS when DB_SSL is undefined", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_SSL: undefined,
            });

            mockReadFileSync.mockClear();

            const config = buildPoolConfig();

            expect(config).not.toHaveProperty("ssl");
            expect(mockReadFileSync).not.toHaveBeenCalled();
        });

        it("configures TLS using the CA, certificate, and key", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_SSL: true,
                DB_SSL_CA: "/certs/ca.pem",
                DB_SSL_CERT: "/certs/client.crt",
                DB_SSL_KEY: "/certs/client.key",
            });

            mockReadFileSync.mockClear();

            const config = buildPoolConfig();

            expect(config).toMatchObject({
                ssl: {
                    ca: "certificate:/certs/ca.pem",
                    cert: "certificate:/certs/client.crt",
                    key: "certificate:/certs/client.key",
                },
            });

            expect(mockReadFileSync).toHaveBeenCalledTimes(3);
        });

        it("throws when the CA certificate cannot be loaded", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_SSL: true,
                DB_SSL_CA: "/certs/ca.pem",
                DB_SSL_CERT: "/certs/client.crt",
                DB_SSL_KEY: "/certs/client.key",
            });

            mockReadFileSync.mockClear();

            mockReadFileSync.mockImplementationOnce(() => {
                throw new Error("Certificate file not found");
            });

            expect(() => {
                buildPoolConfig();
            }).toThrow(
                "Database TLS initialization failed: Certificate file not found",
            );
        });

        it("returns the configured pool minimum and maximum", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_POOL_MIN: "5",
                DB_POOL_MAX: "25",
            });

            const config = buildPoolConfig();

            expect(config.min).toBe(5);
            expect(config.max).toBe(25);
        });

        it("uses pool defaults when values are empty", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_POOL_MIN: "",
                DB_POOL_MAX: "",
            });

            const config = buildPoolConfig();

            expect(config.min).toBe(2);
            expect(config.max).toBe(10);
        });

        it("uses pool defaults when values are zero", async () => {
            const {buildPoolConfig} = await importDatabaseModule({
                DB_POOL_MIN: 0,
                DB_POOL_MAX: 0,
            });

            const config = buildPoolConfig();

            expect(config.min).toBe(2);
            expect(config.max).toBe(10);
        });
    });

    describe("database instance initialization", () => {
        it("creates a pg pool using the generated configuration", async () => {
            await importDatabaseModule({
                DB_HOST: "database.example.com",
                DB_PORT: 5432,
                DB_USER: "app",
                DB_PASS: "secret",
                DB_NAME: "my_database",
            });

            expect(mockPoolConstructor).toHaveBeenCalledTimes(1);
            expect(mockPoolConstructor).toHaveBeenCalledWith(
                expect.objectContaining({
                    host: "database.example.com",
                    port: 5432,
                    user: "app",
                    password: "secret",
                    database: "my_database",
                    min: 2,
                    max: 10,
                }),
            );
        });

        it("registers the pool error listener", async () => {
            await importDatabaseModule();

            expect(mockPoolOn).toHaveBeenCalledWith(
                "error",
                expect.any(Function),
            );
        });

        it("logs pool errors with the database error message", async () => {
            await importDatabaseModule();

            const poolErrorCall = mockPoolOn.mock.calls.find(
                ([event]) => event === "error",
            );

            expect(poolErrorCall).toBeDefined();

            const poolErrorHandler = poolErrorCall![1];

            poolErrorHandler(
                new Error("terminating connection due to administrator command"),
            );

            expect(mockLogger.error).toHaveBeenCalledWith(
                "Postgres pool error: terminating connection due to administrator command",
            );
        });
    });

    describe("checkDbConnection", () => {
        it("executes the database connection health query", async () => {
            const {checkDbConnection} = await importDatabaseModule();

            mockClientQuery.mockClear();

            await checkDbConnection();

            expect(mockClientQuery).toHaveBeenCalledTimes(1);

            const [text] = mockClientQuery.mock.calls[0];

            expect(text).toContain("SELECT 1 + 1");
        });

        it("returns true when the database connection succeeds", async () => {
            const {checkDbConnection} = await importDatabaseModule();

            mockClientQuery.mockResolvedValue({
                command: "SELECT",
                rowCount: 1,
                rows: [{result: 2}],
            });

            const result = await checkDbConnection();

            expect(result).toBe(true);
            expect(mockLogger.info).toHaveBeenCalledWith(
                "🤝 Connected to the database (Kysely/PostgreSQL)",
            );
        });

        it("returns false when the database connection fails", async () => {
            const {checkDbConnection} = await importDatabaseModule();

            mockClientQuery.mockRejectedValue(new Error("connection refused"));

            const result = await checkDbConnection();

            expect(result).toBe(false);
        });
    });
});
