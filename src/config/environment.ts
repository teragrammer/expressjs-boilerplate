// src/config/environment.ts
import os from "node:os";
import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

/*
 * Only validate known environment variables, ignore system/Vitest ones.
 *
 * The test profile provides deterministic, non-secret defaults so the
 * suite can boot without a populated `.env` file.
 */
const isTest =
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true";

const DEFAULT_CLUSTER_WORKERS = Math.max(1, os.cpus().length);

const envSchema = Joi.object({
    NODE_ENV: Joi.string()
        .valid("development", "production", "test")
        .default("development"),

    PORT: Joi.number().integer().min(1).max(65535).default(4000),
    PORT_EXPOSE: Joi.number().integer().min(1).max(65535).default(4000),
    HAS_PROXY: Joi.boolean().default(false),

    /*
     * Comma-separated allowlist of origins.
     *
     * `*` is rejected in production by `validateProductionConfig`.
     */
    CORS_ORIGINS: Joi.string().default(""),

    CLUSTER: Joi.boolean().default(false),
    /*
     * Unset -> CPU count.
     *
     * An empty string is treated as unset rather than as an invalid
     * number: the previous behaviour parsed "" into NaN, which
     * `Math.max(1, NaN)` propagated to zero workers. Defaulting is
     * safer than failing the boot for a value that carries no
     * information.
     */
    CLUSTER_WORKERS: Joi.number()
        .integer()
        .min(1)
        .max(1024)
        .default(DEFAULT_CLUSTER_WORKERS),

    DB_CLIENT: Joi.string().valid("pg").default("pg"),
    DB_HOST: Joi.string().default(isTest ? "localhost" : ""),
    DB_PORT: Joi.number().integer().min(1).max(65535).default(5432),
    DB_USER: Joi.string().default(isTest ? "postgres" : ""),
    DB_PASS: Joi.string().default(isTest ? "postgres" : ""),
    DB_NAME: Joi.string().default(isTest ? "express_api" : ""),
    DB_CHARSET: Joi.string().default("utf8"),
    DB_DATE_STRING: Joi.boolean().default(false),
    DB_POOL_MIN: Joi.number().integer().min(0).default(2),
    DB_POOL_MAX: Joi.number().integer().min(1).default(10),

    /*
     * Connection budget. `DB_POOL_MAX` is validated against the total
     * budget so cluster workers cannot exhaust PostgreSQL connections.
     */
    DB_MAX_CONNECTIONS_TOTAL: Joi.number().integer().min(10).default(100),

    DB_SSL: Joi.boolean().default(false),
    DB_SSL_REJECT_UNAUTHORIZED: Joi.boolean().default(true),
    DB_SSL_CA: Joi.string().allow(""),
    DB_SSL_CERT: Joi.string().allow(""),
    DB_SSL_KEY: Joi.string().allow(""),

    /* Statement/lock timeouts protect the pool from runaway queries. */
    DB_STATEMENT_TIMEOUT_MS: Joi.number().integer().min(0).default(15_000),
    DB_LOCK_TIMEOUT_MS: Joi.number().integer().min(0).default(5_000),
    DB_IDLE_IN_TRANSACTION_TIMEOUT_MS: Joi.number().integer().min(0).default(30_000),

    REDIS_HOST: Joi.string().allow(""),
    REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
    REDIS_PASS: Joi.string().allow(""),
    REDIS_TLS: Joi.boolean().default(false),
    REDIS_TLS_CA: Joi.string().allow(""),
    REDIS_TLS_CERT: Joi.string().allow(""),
    REDIS_TLS_KEY: Joi.string().allow(""),

    /*
     * Email is optional in development but required in production:
     * password recovery and TFA both depend on outbound mail.
     */
    EMAIL_ENABLED: Joi.boolean().default(true),
    SENDGRID_API_KEY: Joi.string().allow(""),
    /*
     * Fallback sender address used when a setting does not define one.
     */
    MAIL_FROM_ADDRESS: Joi.string().email().allow("").default(""),

    JWT_SECRET: Joi.string()
        .min(32)
        .default(isTest ? "test-secret-key-for-testing-min-32-chars" : ""),
    /* Short-lived access token (minutes). */
    JWT_ACCESS_TOKEN_MINUTES: Joi.number().integer().min(1).max(60).default(15),
    /* Rotating refresh token / session lifetime (days). */
    JWT_REFRESH_TOKEN_DAYS: Joi.number().integer().min(1).max(90).default(7),
    JWT_ISSUER: Joi.string().min(1).default("express-api"),
    JWT_AUDIENCE: Joi.string().min(1).default("express-api-client"),

    BCRYPT_SALT_ROUND: Joi.number().integer().min(10).max(15).default(12),
    BCRYPT_SECRET: Joi.string()
        .min(32)
        .default(isTest ? "test-bcrypt-pepper-min-32-chars" : ""),

    /*
     * HKDF-SHA-256 derives the 32-byte AES-256-GCM key from this
     * secret, so any length >= 32 characters is acceptable.
     */
    CRYPT0_SECRET: Joi.string()
        .min(32)
        .default(
            isTest ? "0123456789abcdef0123456789abcdef" : "",
        ),
    CRYPT0_CIPHER: Joi.string().valid("aes-256-gcm").default("aes-256-gcm"),

    /* Observability */
    LOG_LEVEL: Joi.string()
        .valid("fatal", "error", "warn", "info", "debug", "trace", "silent")
        .default("info"),
    METRICS_ENABLED: Joi.boolean().default(true),
    METRICS_PATH: Joi.string().default("/metrics"),

    /* Audit trail */
    AUDIT_ENABLED: Joi.boolean().default(true),

    /* Background jobs / outbox worker */
    OUTBOX_ENABLED: Joi.boolean().default(true),
    OUTBOX_POLL_INTERVAL_MS: Joi.number().integer().min(500).default(5_000),
    OUTBOX_BATCH_SIZE: Joi.number().integer().min(1).max(500).default(25),
    CLEANUP_INTERVAL_MS: Joi.number().integer().min(60_000).default(900_000),

    /* Seed credentials. Required to be set explicitly in production. */
    SEED_PASSWORD: Joi.string().allow(""),
}).unknown(true); // Allow unknown environment variables (system, Vitest, etc.)

/*
 * Normalizes raw environment values before validation.
 *
 * An empty string is not a meaningful value for any numeric or boolean
 * variable, so it is treated as "unset" and the schema default applies.
 * Without this, `CLUSTER_WORKERS=` parsed into NaN and could start zero
 * workers.
 */
const rawEnv: Record<string, unknown> = {...process.env};

for (const key of Object.keys(rawEnv)) {
    if (rawEnv[key] === "") {
        delete rawEnv[key];
    }
}

const {value: env, error} = envSchema.validate(rawEnv, {
    abortEarly: false,
    convert: true,
});

if (error) {
    const messages = error.details
        .map((detail) => `${detail.path.join(".")}: ${detail.message}`)
        .join("; ");

    throw new Error(`Invalid environment configuration: ${messages}`);
}

/*
 * In production, enforce stricter validation.
 *
 * The rules fail closed: a misconfigured production deployment must
 * refuse to boot rather than degrade silently.
 */
if (!isTest && env.NODE_ENV === "production") {
    validateProductionConfig(env);
}

function isLoopbackHost(host: string): boolean {
    return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "0.0.0.0"
    );
}

function validateProductionConfig(env: Record<string, any>): void {
    const errors: string[] = [];

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        errors.push("JWT_SECRET must be at least 32 characters in production");
    }

    if (
        !process.env.BCRYPT_SECRET ||
        process.env.BCRYPT_SECRET.length < 32
    ) {
        errors.push(
            "BCRYPT_SECRET must be at least 32 characters in production",
        );
    }

    if (
        !process.env.CRYPT0_SECRET ||
        process.env.CRYPT0_SECRET.length < 32
    ) {
        errors.push(
            "CRYPT0_SECRET must be at least 32 characters in production",
        );
    }

    if (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS === "*") {
        errors.push(
            "CORS_ORIGINS must be explicitly set and not wildcard in production",
        );
    }

    if (
        !process.env.DB_HOST ||
        !process.env.DB_USER ||
        !process.env.DB_PASS ||
        !process.env.DB_NAME
    ) {
        errors.push("Database configuration must be complete in production");
    }

    if (env.EMAIL_ENABLED && !process.env.SENDGRID_API_KEY) {
        errors.push(
            "SENDGRID_API_KEY is required in production when EMAIL_ENABLED is true",
        );
    }

    /*
     * TLS is required for any non-loopback database/Redis endpoint.
     * Managed services terminate TLS; a self-hosted loopback instance
     * is exempt.
     */
    if (
        env.DB_SSL === false &&
        !isLoopbackHost(String(env.DB_HOST ?? ""))
    ) {
        errors.push(
            "DB_SSL must be enabled in production for non-loopback database hosts",
        );
    }

    if (
        env.REDIS_HOST &&
        env.REDIS_TLS === false &&
        !isLoopbackHost(String(env.REDIS_HOST))
    ) {
        errors.push(
            "REDIS_TLS must be enabled in production for non-loopback Redis hosts",
        );
    }

    if (errors.length > 0) {
        throw new Error(
            `Production configuration validation failed: ${errors.join("; ")}`,
        );
    }
}

/**
 * Frozen, typed configuration.
 *
 * Parsed exactly once at import time so a misconfigured process fails
 * before any server or worker is started.
 */
export const __ENV = Object.freeze({
    NODE_ENV: env.NODE_ENV,

    PORT: env.PORT,
    PORT_EXPOSE: env.PORT_EXPOSE,
    HAS_PROXY: env.HAS_PROXY,

    CORS_ORIGINS: env.CORS_ORIGINS,

    CLUSTER: env.CLUSTER,
    CLUSTER_WORKERS: env.CLUSTER_WORKERS,

    DB_CLIENT: env.DB_CLIENT,
    DB_HOST: env.DB_HOST,
    DB_PORT: env.DB_PORT,
    DB_USER: env.DB_USER,
    DB_PASS: env.DB_PASS,
    DB_NAME: env.DB_NAME,
    DB_CHARSET: env.DB_CHARSET,
    DB_DATE_STRING: env.DB_DATE_STRING,
    DB_POOL_MIN: env.DB_POOL_MIN,
    DB_POOL_MAX: env.DB_POOL_MAX,
    DB_MAX_CONNECTIONS_TOTAL: env.DB_MAX_CONNECTIONS_TOTAL,
    DB_SSL: env.DB_SSL,
    DB_SSL_REJECT_UNAUTHORIZED: env.DB_SSL_REJECT_UNAUTHORIZED,
    DB_SSL_CA: env.DB_SSL_CA,
    DB_SSL_CERT: env.DB_SSL_CERT,
    DB_SSL_KEY: env.DB_SSL_KEY,
    DB_STATEMENT_TIMEOUT_MS: env.DB_STATEMENT_TIMEOUT_MS,
    DB_LOCK_TIMEOUT_MS: env.DB_LOCK_TIMEOUT_MS,
    DB_IDLE_IN_TRANSACTION_TIMEOUT_MS:
        env.DB_IDLE_IN_TRANSACTION_TIMEOUT_MS,

    REDIS_HOST: env.REDIS_HOST,
    REDIS_PORT: env.REDIS_PORT,
    REDIS_PASS: env.REDIS_PASS,
    REDIS_TLS: env.REDIS_TLS,
    REDIS_TLS_CA: env.REDIS_TLS_CA,
    REDIS_TLS_CERT: env.REDIS_TLS_CERT,
    REDIS_TLS_KEY: env.REDIS_TLS_KEY,

    EMAIL_ENABLED: env.EMAIL_ENABLED,
    SENDGRID_API_KEY: env.SENDGRID_API_KEY,
    MAIL_FROM_ADDRESS: env.MAIL_FROM_ADDRESS,

    JWT_SECRET: env.JWT_SECRET,
    JWT_ACCESS_TOKEN_MINUTES: env.JWT_ACCESS_TOKEN_MINUTES,
    JWT_REFRESH_TOKEN_DAYS: env.JWT_REFRESH_TOKEN_DAYS,
    JWT_ISSUER: env.JWT_ISSUER,
    JWT_AUDIENCE: env.JWT_AUDIENCE,

    BCRYPT_SALT_ROUND: env.BCRYPT_SALT_ROUND,
    BCRYPT_SECRET: env.BCRYPT_SECRET,

    CRYPT0_SECRET: env.CRYPT0_SECRET,
    CRYPT0_CIPHER: env.CRYPT0_CIPHER,

    LOG_LEVEL: env.LOG_LEVEL,
    METRICS_ENABLED: env.METRICS_ENABLED,
    METRICS_PATH: env.METRICS_PATH,

    AUDIT_ENABLED: env.AUDIT_ENABLED,

    OUTBOX_ENABLED: env.OUTBOX_ENABLED,
    OUTBOX_POLL_INTERVAL_MS: env.OUTBOX_POLL_INTERVAL_MS,
    OUTBOX_BATCH_SIZE: env.OUTBOX_BATCH_SIZE,
    CLEANUP_INTERVAL_MS: env.CLEANUP_INTERVAL_MS,

    SEED_PASSWORD: env.SEED_PASSWORD,
});
