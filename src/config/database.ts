// src/config/database.ts
import fs from "fs";
import {Kysely, PostgresDialect, sql, Transaction} from "kysely";
import {Pool, PoolConfig} from "pg";
import {__ENV} from "./environment";
import {logger} from "./logger";
import type {Database} from "./schema";

/**
 * A query executor: either the shared instance or a transaction.
 *
 * Repositories accept this type so transactional callers can pass
 * the transaction straight through without re-wrapping queries.
 */
export type DatabaseExecutor = Kysely<Database> | Transaction<Database>;

/**
 * Builds the `pg` pool configuration from the environment.
 *
 * Kept pure (no I/O besides optional TLS file reads) so it stays
 * unit-testable without a live database.
 */
export function buildPoolConfig(): PoolConfig {
    const config: PoolConfig = {
        host: __ENV.DB_HOST,
        port: Number(__ENV.DB_PORT),
        user: __ENV.DB_USER,
        password: __ENV.DB_PASS,
        database: __ENV.DB_NAME,
        min: Number(__ENV.DB_POOL_MIN || 2),
        max: Number(__ENV.DB_POOL_MAX || 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
        application_name: "express-api",
        /*
         * Server-side timeouts protect the pool: a runaway query or a
         * long-held lock cannot occupy a connection indefinitely.
         */
        statement_timeout: Number(__ENV.DB_STATEMENT_TIMEOUT_MS),
        lock_timeout: Number(__ENV.DB_LOCK_TIMEOUT_MS),
        idle_in_transaction_session_timeout: Number(
            __ENV.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,
        ),
    };

    if (__ENV.DB_SSL) {
        try {
            const caPath = __ENV.DB_SSL_CA;
            const certPath = __ENV.DB_SSL_CERT;
            const keyPath = __ENV.DB_SSL_KEY;

            if (Boolean(certPath) !== Boolean(keyPath)) {
                throw new Error(
                    "DB_SSL_CERT and DB_SSL_KEY must be configured together",
                );
            }

            const rejectUnauthorized =
                __ENV.DB_SSL_REJECT_UNAUTHORIZED !== false;

            const ssl: NonNullable<PoolConfig["ssl"]> = {
                rejectUnauthorized,
                ca: caPath
                    ? fs.readFileSync(caPath, "utf8")
                    : undefined,
                cert: certPath
                    ? fs.readFileSync(certPath, "utf8")
                    : undefined,
                key: keyPath
                    ? fs.readFileSync(keyPath, "utf8")
                    : undefined,
            };

            if (!rejectUnauthorized) {
                logger.warn(
                    "Database TLS certificate verification is disabled " +
                    "(DB_SSL_REJECT_UNAUTHORIZED=false).",
                );
            }

            config.ssl = ssl;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);

            throw new Error(
                `Database TLS initialization failed: ${message}`,
                { cause: error },
            );
        }
    }

    return config;
}

function createPool(): Pool {
    const pool = new Pool(buildPoolConfig());

    pool.on("error", (error) => {
        logger.error(`Postgres pool error: ${error.message}`);
    });

    return pool;
}

function createDatabaseInstance(): Kysely<Database> {
    return new Kysely<Database>({
        dialect: new PostgresDialect({
            pool: createPool(),
        }),
        log: (event) => {
            // Only error events are logged: successful statements may
            // carry PII in their parameters and must stay out of logs.
            if (event.level === "error") {
                const message =
                    event.error instanceof Error
                        ? event.error.message
                        : String(event.error);

                logger.error(`Database query error: ${message}`);
                logger.error(
                    `Database query details: ${event.query.sql}`,
                );
            }
        },
    });
}

/**
 * Shared Kysely instance (PostgreSQL).
 */
export const db = createDatabaseInstance();

/**
 * Runs `callback` inside a database transaction.
 *
 * The transaction is committed when the callback resolves and rolled
 * back when it throws. This is the application-level unit of work used
 * by multi-step writes such as registration and password reset.
 */
export async function withTransaction<T>(
    callback: (trx: Transaction<Database>) => Promise<T>,
    dbInstance: Kysely<Database> = db,
): Promise<T> {
    return dbInstance.transaction().execute(callback);
}

/**
 * Validates the connection budget for the current process topology.
 *
 * Each cluster worker opens its own pool, so the per-worker maximum
 * multiplied by the worker count must stay below the server's total
 * connection limit.
 */
export function validateConnectionBudget(
    options: {
        poolMax: number;
        workers: number;
        maxConnections: number;
        reserve?: number;
    },
): {valid: boolean; projected: number; recommended: number} {
    const reserve = options.reserve ?? 20;
    const projected = options.poolMax * options.workers;
    const recommended = Math.max(
        1,
        Math.floor(
            (options.maxConnections - reserve) / Math.max(1, options.workers),
        ),
    );

    return {
        valid: projected + reserve <= options.maxConnections,
        projected,
        recommended,
    };
}

/**
 * Enforces the connection budget and fails the boot when it is exceeded.
 *
 * Logging a warning and continuing would let a cluster deployment exhaust
 * PostgreSQL's connection limit and turn a startup error into an outage.
 */
export function assertConnectionBudget(
    options: {
        poolMax: number;
        workers: number;
        maxConnections: number;
        reserve?: number;
    },
): {valid: boolean; projected: number; recommended: number} {
    const budget = validateConnectionBudget(options);

    if (!budget.valid) {
        throw new Error(
            `Connection budget exceeded: ${options.workers} worker(s) x ` +
            `DB_POOL_MAX=${options.poolMax} projects to ` +
            `${budget.projected} connections against a limit of ` +
            `${options.maxConnections}. ` +
            `Recommended DB_POOL_MAX is ${budget.recommended}.`,
        );
    }

    return budget;
}

/**
 * Health check used on boot to fail fast when PostgreSQL is down.
 */
export async function checkDbConnection(): Promise<boolean> {
    try {
        await sql`SELECT 1 + 1 AS result`.execute(db);
        logger.info("🤝 Connected to the database (Kysely/PostgreSQL)");
        return true;
    } catch (error) {
        logger.error(
            `Kysely failed to connect to the database: ${error}`,
        );
        return false;
    }
}

/**
 * Drains the PostgreSQL pool. Call on graceful shutdown and in
 * test teardown.
 */
export async function closeDatabase(): Promise<void> {
    await db.destroy();
}
