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
    };

    if (__ENV.DB_SSL) {
        try {
            config.ssl = {
                ca: __ENV.DB_SSL_CA
                    ? fs.readFileSync(__ENV.DB_SSL_CA, "utf8")
                    : undefined,
                cert: fs.readFileSync(__ENV.DB_SSL_CERT, "utf8"),
                key: fs.readFileSync(__ENV.DB_SSL_KEY, "utf8"),
                rejectUnauthorized: false, // Required for self-signed chain setups
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);

            throw new Error(
                `Database TLS initialization failed: ${message}`,
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
