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
// src/config/database.spec.ts
const vitest_1 = require("vitest");
const { mockPoolConstructor, mockPoolOn, mockClientQuery, mockClientRelease, mockPoolConnect, mockReadFileSync, mockLogger, } = vitest_1.vi.hoisted(() => {
    const mockPoolOn = vitest_1.vi.fn();
    const mockClientQuery = vitest_1.vi.fn();
    const mockClientRelease = vitest_1.vi.fn();
    const mockPoolConnect = vitest_1.vi.fn().mockImplementation(() => Promise.resolve({
        query: mockClientQuery,
        release: mockClientRelease,
    }));
    // NOTE: must be a `function` (not an arrow) so `new Pool()` works.
    const mockPoolConstructor = vitest_1.vi.fn(function (..._args) {
        return {
            on: mockPoolOn,
            connect: mockPoolConnect,
        };
    });
    const mockReadFileSync = vitest_1.vi.fn();
    const mockLogger = {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
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
vitest_1.vi.mock("pg", () => ({
    Pool: mockPoolConstructor,
}));
vitest_1.vi.mock("fs", () => ({
    default: {
        readFileSync: mockReadFileSync,
    },
    readFileSync: mockReadFileSync,
}));
vitest_1.vi.mock("./logger", () => ({
    logger: mockLogger,
}));
function mockEnvironment(overrides = {}) {
    vitest_1.vi.doMock("./environment", () => ({
        __ENV: Object.assign({ DB_HOST: "localhost", DB_PORT: 5432, DB_USER: "postgres", DB_PASS: "postgres-password", DB_NAME: "application", DB_SSL: false, DB_SSL_CA: "", DB_SSL_CERT: "", DB_SSL_KEY: "", DB_POOL_MIN: 2, DB_POOL_MAX: 10 }, overrides),
    }));
}
function importDatabaseModule() {
    return __awaiter(this, arguments, void 0, function* (environment = {}) {
        vitest_1.vi.resetModules();
        mockEnvironment(environment);
        return Promise.resolve().then(() => __importStar(require("./database")));
    });
}
(0, vitest_1.describe)("Database configuration", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockPoolConstructor.mockImplementation(function (..._args) {
            return {
                on: mockPoolOn,
                connect: mockPoolConnect,
            };
        });
        mockPoolConnect.mockImplementation(() => Promise.resolve({
            query: mockClientQuery,
            release: mockClientRelease,
        }));
        mockClientQuery.mockResolvedValue({
            command: "SELECT",
            rowCount: 1,
            rows: [{ result: 2 }],
        });
        mockReadFileSync.mockImplementation((path) => `certificate:${path}`);
    });
    (0, vitest_1.describe)("buildPoolConfig", () => {
        (0, vitest_1.it)("uses the configured connection properties", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_HOST: "db.example.com",
                DB_PORT: "5433",
                DB_USER: "application-user",
                DB_PASS: "super-secret",
                DB_NAME: "production",
            });
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config).toMatchObject({
                host: "db.example.com",
                port: 5433,
                user: "application-user",
                password: "super-secret",
                database: "production",
            });
        }));
        (0, vitest_1.it)("converts the database port to a number", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_PORT: "5433",
            });
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config.port).toBe(5433);
            (0, vitest_1.expect)(typeof config.port).toBe("number");
        }));
        (0, vitest_1.it)("supports a numeric database port", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_PORT: 5432,
            });
            (0, vitest_1.expect)(buildPoolConfig().port).toBe(5432);
        }));
        (0, vitest_1.it)("does not configure TLS when DB_SSL is false", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_SSL: false,
            });
            mockReadFileSync.mockClear();
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config).not.toHaveProperty("ssl");
            (0, vitest_1.expect)(mockReadFileSync).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("does not configure TLS when DB_SSL is undefined", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_SSL: undefined,
            });
            mockReadFileSync.mockClear();
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config).not.toHaveProperty("ssl");
            (0, vitest_1.expect)(mockReadFileSync).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("configures TLS using the CA, certificate, and key", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_SSL: true,
                DB_SSL_CA: "/certs/ca.pem",
                DB_SSL_CERT: "/certs/client.crt",
                DB_SSL_KEY: "/certs/client.key",
            });
            mockReadFileSync.mockClear();
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config).toMatchObject({
                ssl: {
                    ca: "certificate:/certs/ca.pem",
                    cert: "certificate:/certs/client.crt",
                    key: "certificate:/certs/client.key",
                },
            });
            (0, vitest_1.expect)(mockReadFileSync).toHaveBeenCalledTimes(3);
        }));
        (0, vitest_1.it)("throws when the CA certificate cannot be loaded", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_SSL: true,
                DB_SSL_CA: "/certs/ca.pem",
                DB_SSL_CERT: "/certs/client.crt",
                DB_SSL_KEY: "/certs/client.key",
            });
            mockReadFileSync.mockClear();
            mockReadFileSync.mockImplementationOnce(() => {
                throw new Error("Certificate file not found");
            });
            (0, vitest_1.expect)(() => {
                buildPoolConfig();
            }).toThrow("Database TLS initialization failed: Certificate file not found");
        }));
        (0, vitest_1.it)("returns the configured pool minimum and maximum", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_POOL_MIN: "5",
                DB_POOL_MAX: "25",
            });
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config.min).toBe(5);
            (0, vitest_1.expect)(config.max).toBe(25);
        }));
        (0, vitest_1.it)("uses pool defaults when values are empty", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_POOL_MIN: "",
                DB_POOL_MAX: "",
            });
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config.min).toBe(2);
            (0, vitest_1.expect)(config.max).toBe(10);
        }));
        (0, vitest_1.it)("uses pool defaults when values are zero", () => __awaiter(void 0, void 0, void 0, function* () {
            const { buildPoolConfig } = yield importDatabaseModule({
                DB_POOL_MIN: 0,
                DB_POOL_MAX: 0,
            });
            const config = buildPoolConfig();
            (0, vitest_1.expect)(config.min).toBe(2);
            (0, vitest_1.expect)(config.max).toBe(10);
        }));
    });
    (0, vitest_1.describe)("database instance initialization", () => {
        (0, vitest_1.it)("creates a pg pool using the generated configuration", () => __awaiter(void 0, void 0, void 0, function* () {
            yield importDatabaseModule({
                DB_HOST: "database.example.com",
                DB_PORT: 5432,
                DB_USER: "app",
                DB_PASS: "secret",
                DB_NAME: "my_database",
            });
            (0, vitest_1.expect)(mockPoolConstructor).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockPoolConstructor).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                host: "database.example.com",
                port: 5432,
                user: "app",
                password: "secret",
                database: "my_database",
                min: 2,
                max: 10,
            }));
        }));
        (0, vitest_1.it)("registers the pool error listener", () => __awaiter(void 0, void 0, void 0, function* () {
            yield importDatabaseModule();
            (0, vitest_1.expect)(mockPoolOn).toHaveBeenCalledWith("error", vitest_1.expect.any(Function));
        }));
        (0, vitest_1.it)("logs pool errors with the database error message", () => __awaiter(void 0, void 0, void 0, function* () {
            yield importDatabaseModule();
            const poolErrorCall = mockPoolOn.mock.calls.find(([event]) => event === "error");
            (0, vitest_1.expect)(poolErrorCall).toBeDefined();
            const poolErrorHandler = poolErrorCall[1];
            poolErrorHandler(new Error("terminating connection due to administrator command"));
            (0, vitest_1.expect)(mockLogger.error).toHaveBeenCalledWith("Postgres pool error: terminating connection due to administrator command");
        }));
    });
    (0, vitest_1.describe)("checkDbConnection", () => {
        (0, vitest_1.it)("executes the database connection health query", () => __awaiter(void 0, void 0, void 0, function* () {
            const { checkDbConnection } = yield importDatabaseModule();
            mockClientQuery.mockClear();
            yield checkDbConnection();
            (0, vitest_1.expect)(mockClientQuery).toHaveBeenCalledTimes(1);
            const [text] = mockClientQuery.mock.calls[0];
            (0, vitest_1.expect)(text).toContain("SELECT 1 + 1");
        }));
        (0, vitest_1.it)("returns true when the database connection succeeds", () => __awaiter(void 0, void 0, void 0, function* () {
            const { checkDbConnection } = yield importDatabaseModule();
            mockClientQuery.mockResolvedValue({
                command: "SELECT",
                rowCount: 1,
                rows: [{ result: 2 }],
            });
            const result = yield checkDbConnection();
            (0, vitest_1.expect)(result).toBe(true);
            (0, vitest_1.expect)(mockLogger.info).toHaveBeenCalledWith("🤝 Connected to the database (Kysely/PostgreSQL)");
        }));
        (0, vitest_1.it)("returns false when the database connection fails", () => __awaiter(void 0, void 0, void 0, function* () {
            const { checkDbConnection } = yield importDatabaseModule();
            mockClientQuery.mockRejectedValue(new Error("connection refused"));
            const result = yield checkDbConnection();
            (0, vitest_1.expect)(result).toBe(false);
        }));
    });
});
