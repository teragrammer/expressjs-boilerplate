// src/config/env.schema.ts
import os from "node:os";
import Joi from "joi";

/**
 * Environment profiles.
 *
 * The test profile provides deterministic, non-secret defaults so the
 * suite can boot without a populated `.env` file.
 */
export function isTestEnvironment(
    env: NodeJS.ProcessEnv = process.env,
): boolean {
    return env.NODE_ENV === "test" || env.VITEST === "true";
}

export const DEFAULT_CLUSTER_WORKERS = Math.max(1, os.cpus().length);

/**
 * Joi schema for every known environment variable.
 *
 * Unknown variables are allowed so system and test-runner variables
 * (PATH, VITEST, etc.) do not fail validation.
 */
export function createEnvSchema(isTest: boolean) {
    return Joi.object({
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
}

/**
 * Normalizes raw environment values before validation.
 *
 * An empty string is not a meaningful value for any numeric or boolean
 * variable, so it is treated as "unset" and the schema default applies.
 * Without this, `CLUSTER_WORKERS=` parsed into NaN and could start zero
 * workers.
 */
export function normalizeEnvironment(
    env: NodeJS.ProcessEnv = process.env,
): Record<string, unknown> {
    const normalized: Record<string, unknown> = {...env};

    for (const key of Object.keys(normalized)) {
        if (normalized[key] === "") {
            delete normalized[key];
        }
    }

    return normalized;
}

export function isLoopbackHost(host: string): boolean {
    return (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "::1" ||
        host === "0.0.0.0"
    );
}

/**
 * In production, enforce stricter validation.
 *
 * The rules fail closed: a misconfigured production deployment must
 * refuse to boot rather than degrade silently.
 */
export function validateProductionConfig(
    env: Record<string, any>,
    sourceEnv: NodeJS.ProcessEnv = process.env,
): void {
    const errors: string[] = [];

    if (!sourceEnv.JWT_SECRET || sourceEnv.JWT_SECRET.length < 32) {
        errors.push("JWT_SECRET must be at least 32 characters in production");
    }

    if (
        !sourceEnv.BCRYPT_SECRET ||
        sourceEnv.BCRYPT_SECRET.length < 32
    ) {
        errors.push(
            "BCRYPT_SECRET must be at least 32 characters in production",
        );
    }

    if (
        !sourceEnv.CRYPT0_SECRET ||
        sourceEnv.CRYPT0_SECRET.length < 32
    ) {
        errors.push(
            "CRYPT0_SECRET must be at least 32 characters in production",
        );
    }

    if (!sourceEnv.CORS_ORIGINS || sourceEnv.CORS_ORIGINS === "*") {
        errors.push(
            "CORS_ORIGINS must be explicitly set and not wildcard in production",
        );
    }

    if (
        !sourceEnv.DB_HOST ||
        !sourceEnv.DB_USER ||
        !sourceEnv.DB_PASS ||
        !sourceEnv.DB_NAME
    ) {
        errors.push("Database configuration must be complete in production");
    }

    if (env.EMAIL_ENABLED && !sourceEnv.SENDGRID_API_KEY) {
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
