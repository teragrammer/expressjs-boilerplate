// src/config/environment.ts
import dotenv from "dotenv";
import {
    assertExplicitNodeEnv,
    createEnvSchema,
    findUnknownApplicationVariables,
    isTestEnvironment,
    normalizeEnvironment,
    validateProductionConfig,
} from "./env.schema";

dotenv.config();

/*
 * Only validate known environment variables, ignore system/Vitest ones.
 *
 * The test profile provides deterministic, non-secret defaults so the
 * suite can boot without a populated `.env` file.
 */
const isTest = isTestEnvironment();

/*
 * Fail closed if a deployment forgets NODE_ENV: defaulting to
 * development would silently disable production safeguards.
 */
assertExplicitNodeEnv(process.env, isTest);

const schema = createEnvSchema(isTest);

const {value: env, error} = schema.validate(
    normalizeEnvironment(),
    {
        abortEarly: false,
        convert: true,
    },
);

if (error) {
    const messages = error.details
        .map((detail) => `${detail.path.join(".")}: ${detail.message}`)
        .join("; ");

    throw new Error(`Invalid environment configuration: ${messages}`);
}

const knownKeys = new Set(Object.keys(schema.describe().keys));
const unknownVariables = findUnknownApplicationVariables(
    process.env,
    knownKeys,
);

if (unknownVariables.length > 0) {
    /*
     * Names only: values may contain secrets and must never be logged.
     */
    process.emitWarning(
        "Unknown application environment variable(s) ignored: " +
        unknownVariables.join(", "),
    );
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
    REDIS_TLS_SERVERNAME: env.REDIS_TLS_SERVERNAME,

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
