// src/config/environment.ts
import dotenv from "dotenv";

dotenv.config();

export const __ENV = Object.freeze({
    NODE_ENV: process.env.NODE_ENV || "development",

    PORT: getInt("PORT", 4000),
    PORT_EXPOSE: getInt("PORT_EXPOSE", 4000),
    HAS_PROXY: getBol("HAS_PROXY"),

    CORS_ORIGINS: getStr("CORS_ORIGINS"),

    CLUSTER: getBol("CLUSTER"),
    CLUSTER_WORKERS: getInt("CLUSTER_WORKERS"),

    DB_CLIENT: "pg",
    DB_HOST: getStr("DB_HOST"),
    DB_PORT: getInt("DB_PORT", 5432),
    DB_USER: getStr("DB_USER"),
    DB_PASS: getStr("DB_PASS"),
    DB_NAME: getStr("DB_NAME"),
    DB_CHARSET: getStr("DB_CHARSET"),
    DB_DATE_STRING: getBol("DB_DATE_STRING"),
    DB_POOL_MIN: getInt("DB_POOL_MIN", 2),
    DB_POOL_MAX: getInt("DB_POOL_MAX", 10),
    DB_SSL: getBol("DB_SSL"),
    DB_SSL_REJECT_UNAUTHORIZED: getBol("DB_SSL_REJECT_UNAUTHORIZED"),
    DB_SSL_CA: getStr("DB_SSL_CA"),
    DB_SSL_CERT: getStr("DB_SSL_CERT"),
    DB_SSL_KEY: getStr("DB_SSL_KEY"),

    REDIS_HOST: getStr("REDIS_HOST"),
    REDIS_PORT: getInt("REDIS_PORT"),
    REDIS_PASS: getStr("REDIS_PASS"),
    REDIS_TLS: getBol("REDIS_TLS"),
    REDIS_TLS_CA: getStr("REDIS_TLS_CA"),
    REDIS_TLS_CERT: getStr("REDIS_TLS_CERT"),
    REDIS_TLS_KEY: getStr("REDIS_TLS_KEY"),

    SENDGRID_API_KEY: getStr("SENDGRID_API_KEY"),

    JWT_TFA: getBol("JWT_TFA"),
    JWT_SECRET: getStr("JWT_SECRET"),
    JWT_EXPIRATION_DAYS: getInt("JWT_EXPIRATION_DAYS", 7), // days

    BCRYPT_SALT_ROUND: getInt("BCRYPT_SALT_ROUND"),
    BCRYPT_SECRET: getStr("BCRYPT_SECRET"),

    CRYPT0_SECRET: getStr("CRYPT0_SECRET"),
    CRYPT0_CIPHER: getStr("CRYPT0_CIPHER"),
    CRYPTO_IV: getInt("CRYPTO_IV"),
});

function getStr(key: string, fixed: string = ""): string {
    return typeof process.env[key] !== "undefined" ? process.env[key]! : fixed;
}

function getInt(key: string, fixed: number = 0): number {
    return typeof process.env[key] !== "undefined" ? parseInt(process.env[key]!) : fixed;
}

function getBol(key: string): boolean {
    return typeof process.env[key] !== "undefined" && process.env[key] === "true";
}
