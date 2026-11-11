"use strict";
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
exports.db = void 0;
exports.buildPoolConfig = buildPoolConfig;
exports.withTransaction = withTransaction;
exports.validateConnectionBudget = validateConnectionBudget;
exports.checkDbConnection = checkDbConnection;
exports.closeDatabase = closeDatabase;
// src/config/database.ts
const fs_1 = __importDefault(require("fs"));
const kysely_1 = require("kysely");
const pg_1 = require("pg");
const environment_1 = require("./environment");
const logger_1 = require("./logger");
/**
 * Builds the `pg` pool configuration from the environment.
 *
 * Kept pure (no I/O besides optional TLS file reads) so it stays
 * unit-testable without a live database.
 */
function buildPoolConfig() {
    const config = {
        host: environment_1.__ENV.DB_HOST,
        port: Number(environment_1.__ENV.DB_PORT),
        user: environment_1.__ENV.DB_USER,
        password: environment_1.__ENV.DB_PASS,
        database: environment_1.__ENV.DB_NAME,
        min: Number(environment_1.__ENV.DB_POOL_MIN || 2),
        max: Number(environment_1.__ENV.DB_POOL_MAX || 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
        application_name: "express-api",
        /*
         * Server-side timeouts protect the pool: a runaway query or a
         * long-held lock cannot occupy a connection indefinitely.
         */
        statement_timeout: Number(environment_1.__ENV.DB_STATEMENT_TIMEOUT_MS),
        lock_timeout: Number(environment_1.__ENV.DB_LOCK_TIMEOUT_MS),
        idle_in_transaction_session_timeout: Number(environment_1.__ENV.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS),
    };
    if (environment_1.__ENV.DB_SSL) {
        try {
            config.ssl = {
                ca: environment_1.__ENV.DB_SSL_CA
                    ? fs_1.default.readFileSync(environment_1.__ENV.DB_SSL_CA, "utf8")
                    : undefined,
                cert: fs_1.default.readFileSync(environment_1.__ENV.DB_SSL_CERT, "utf8"),
                key: fs_1.default.readFileSync(environment_1.__ENV.DB_SSL_KEY, "utf8"),
                rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === undefined
                    ? true
                    : environment_1.__ENV.DB_SSL_REJECT_UNAUTHORIZED,
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Database TLS initialization failed: ${message}`, { cause: error });
        }
    }
    return config;
}
function createPool() {
    const pool = new pg_1.Pool(buildPoolConfig());
    pool.on("error", (error) => {
        logger_1.logger.error(`Postgres pool error: ${error.message}`);
    });
    return pool;
}
function createDatabaseInstance() {
    return new kysely_1.Kysely({
        dialect: new kysely_1.PostgresDialect({
            pool: createPool(),
        }),
        log: (event) => {
            // Only error events are logged: successful statements may
            // carry PII in their parameters and must stay out of logs.
            if (event.level === "error") {
                const message = event.error instanceof Error
                    ? event.error.message
                    : String(event.error);
                logger_1.logger.error(`Database query error: ${message}`);
                logger_1.logger.error(`Database query details: ${event.query.sql}`);
            }
        },
    });
}
/**
 * Shared Kysely instance (PostgreSQL).
 */
exports.db = createDatabaseInstance();
/**
 * Runs `callback` inside a database transaction.
 *
 * The transaction is committed when the callback resolves and rolled
 * back when it throws. This is the application-level unit of work used
 * by multi-step writes such as registration and password reset.
 */
function withTransaction(callback_1) {
    return __awaiter(this, arguments, void 0, function* (callback, dbInstance = exports.db) {
        return dbInstance.transaction().execute(callback);
    });
}
/**
 * Validates the connection budget for the current process topology.
 *
 * Each cluster worker opens its own pool, so the per-worker maximum
 * multiplied by the worker count must stay below the server's total
 * connection limit.
 */
function validateConnectionBudget(options) {
    var _a;
    const reserve = (_a = options.reserve) !== null && _a !== void 0 ? _a : 20;
    const projected = options.poolMax * options.workers;
    const recommended = Math.max(1, Math.floor((options.maxConnections - reserve) / Math.max(1, options.workers)));
    return {
        valid: projected + reserve <= options.maxConnections,
        projected,
        recommended,
    };
}
/**
 * Health check used on boot to fail fast when PostgreSQL is down.
 */
function checkDbConnection() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, kysely_1.sql) `SELECT 1 + 1 AS result`.execute(exports.db);
            logger_1.logger.info("🤝 Connected to the database (Kysely/PostgreSQL)");
            return true;
        }
        catch (error) {
            logger_1.logger.error(`Kysely failed to connect to the database: ${error}`);
            return false;
        }
    });
}
/**
 * Drains the PostgreSQL pool. Call on graceful shutdown and in
 * test teardown.
 */
function closeDatabase() {
    return __awaiter(this, void 0, void 0, function* () {
        yield exports.db.destroy();
    });
}
