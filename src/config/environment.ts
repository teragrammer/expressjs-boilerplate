// src/config/environment.ts
import dotenv from "dotenv";
import Joi from "joi";

dotenv.config();

// Only validate known environment variables, ignore system/Vitest ones
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

const envSchema = Joi.object({
    NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),

    PORT: Joi.number().integer().min(1).max(65535).default(4000),
    PORT_EXPOSE: Joi.number().integer().min(1).max(65535).default(4000),
    HAS_PROXY: Joi.boolean().default(false),

    CORS_ORIGINS: Joi.string().default(""),

    CLUSTER: Joi.boolean().default(false),
    CLUSTER_WORKERS: Joi.number().integer().min(1).default(require("os").cpus().length).allow("", null),

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
    DB_SSL: Joi.boolean().default(false),
    DB_SSL_REJECT_UNAUTHORIZED: Joi.boolean().default(true),
    DB_SSL_CA: Joi.string().allow(""),
    DB_SSL_CERT: Joi.string().allow(""),
    DB_SSL_KEY: Joi.string().allow(""),

    REDIS_HOST: Joi.string().allow(""),
    REDIS_PORT: Joi.number().integer().min(1).max(65535).default(6379),
    REDIS_PASS: Joi.string().allow(""),
    REDIS_TLS: Joi.boolean().default(false),
    REDIS_TLS_CA: Joi.string().allow(""),
    REDIS_TLS_CERT: Joi.string().allow(""),
    REDIS_TLS_KEY: Joi.string().allow(""),

    SENDGRID_API_KEY: Joi.string().allow(""),

    JWT_TFA: Joi.boolean().default(false),
    JWT_SECRET: Joi.string().min(32).default(isTest ? "test-secret-key-for-testing-min-32-chars" : ""),
    JWT_EXPIRATION_DAYS: Joi.number().integer().min(1).max(90).default(7),

    BCRYPT_SALT_ROUND: Joi.number().integer().min(10).max(15).default(12),
    BCRYPT_SECRET: Joi.string().min(32).default(isTest ? "test-bcrypt-pepper-min-32-chars" : ""),

    CRYPT0_SECRET: Joi.string().length(32).default(isTest ? "0123456789abcdef0123456789abcdef" : ""),
    CRYPT0_CIPHER: Joi.string().default("aes-256-gcm"),
    CRYPTO_IV: Joi.number().integer().min(12).max(16).default(12),
}).unknown(true); // Allow unknown environment variables (system, Vitest, etc.)

const {value: env, error} = envSchema.validate(process.env, {abortEarly: false, convert: true});

if (error) {
    const messages = error.details.map(d => `${d.path.join(".")}: ${d.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${messages}`);
}

// In production, enforce stricter validation
if (!isTest && env.NODE_ENV === "production") {
    validateProductionConfig(env);
}

function validateProductionConfig(env: any): void {
    const errors: string[] = [];

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
        errors.push("JWT_SECRET must be at least 32 characters in production");
    }
    if (!process.env.BCRYPT_SECRET || process.env.BCRYPT_SECRET.length < 32) {
        errors.push("BCRYPT_SECRET must be at least 32 characters in production");
    }
    if (!process.env.CRYPT0_SECRET || process.env.CRYPT0_SECRET.length !== 32) {
        errors.push("CRYPT0_SECRET must be exactly 32 characters in production");
    }
    if (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS === "*") {
        errors.push("CORS_ORIGINS must be explicitly set and not wildcard in production");
    }
    if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_NAME) {
        errors.push("Database configuration must be complete in production");
    }

    if (errors.length > 0) {
        throw new Error(`Production configuration validation failed: ${errors.join("; ")}`);
    }
}

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
    DB_SSL: env.DB_SSL,
    DB_SSL_REJECT_UNAUTHORIZED: env.DB_SSL_REJECT_UNAUTHORIZED,
    DB_SSL_CA: env.DB_SSL_CA,
    DB_SSL_CERT: env.DB_SSL_CERT,
    DB_SSL_KEY: env.DB_SSL_KEY,

    REDIS_HOST: env.REDIS_HOST,
    REDIS_PORT: env.REDIS_PORT,
    REDIS_PASS: env.REDIS_PASS,
    REDIS_TLS: env.REDIS_TLS,
    REDIS_TLS_CA: env.REDIS_TLS_CA,
    REDIS_TLS_CERT: env.REDIS_TLS_CERT,
    REDIS_TLS_KEY: env.REDIS_TLS_KEY,

    SENDGRID_API_KEY: env.SENDGRID_API_KEY,

    JWT_TFA: env.JWT_TFA,
    JWT_SECRET: env.JWT_SECRET,
    JWT_EXPIRATION_DAYS: env.JWT_EXPIRATION_DAYS,

    BCRYPT_SALT_ROUND: env.BCRYPT_SALT_ROUND,
    BCRYPT_SECRET: env.BCRYPT_SECRET,

    CRYPT0_SECRET: env.CRYPT0_SECRET,
    CRYPT0_CIPHER: env.CRYPT0_CIPHER,
    CRYPTO_IV: env.CRYPTO_IV,
});
