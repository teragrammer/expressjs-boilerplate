// src/config/env.schema.spec.ts
import {describe, expect, it} from "vitest";

import {
    createEnvSchema,
    DEFAULT_CLUSTER_WORKERS,
    isLoopbackHost,
    isTestEnvironment,
    normalizeEnvironment,
    validateProductionConfig,
} from "./env.schema";

const secret = "a".repeat(32);

const validProductionSourceEnv: NodeJS.ProcessEnv = {
    JWT_SECRET: secret,
    BCRYPT_SECRET: secret,
    CRYPT0_SECRET: secret,
    CORS_ORIGINS: "https://example.com",
    DB_HOST: "db.example.com",
    DB_USER: "app",
    DB_PASS: "password",
    DB_NAME: "app",
    SENDGRID_API_KEY: "sendgrid-key",
};

const validProductionEnv = {
    ...validProductionSourceEnv,
    EMAIL_ENABLED: true,
    DB_SSL: true,
    REDIS_HOST: "redis.example.com",
    REDIS_TLS: true,
};

describe("isTestEnvironment", () => {
    it("should detect NODE_ENV=test", () => {
        expect(isTestEnvironment({NODE_ENV: "test"})).toBe(true);
    });

    it("should detect VITEST=true", () => {
        expect(isTestEnvironment({VITEST: "true"})).toBe(true);
    });

    it("should not treat other values as a test environment", () => {
        expect(isTestEnvironment({NODE_ENV: "development"})).toBe(false);
        expect(isTestEnvironment({VITEST: "1"})).toBe(false);
        expect(isTestEnvironment({})).toBe(false);
    });
});

describe("DEFAULT_CLUSTER_WORKERS", () => {
    it("should always be at least one", () => {
        expect(DEFAULT_CLUSTER_WORKERS).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(DEFAULT_CLUSTER_WORKERS)).toBe(true);
    });
});

describe("createEnvSchema", () => {
    it("should apply the test defaults without requiring a populated .env", () => {
        const {value, error} = createEnvSchema(true).validate({});

        expect(error).toBeUndefined();
        expect(value).toMatchObject({
            NODE_ENV: "development",
            DB_CLIENT: "pg",
            DB_HOST: "localhost",
            DB_USER: "postgres",
            DB_PASS: "postgres",
            DB_NAME: "express_api",
            DB_PORT: 5432,
            JWT_SECRET: "test-secret-key-for-testing-min-32-chars",
            BCRYPT_SECRET: "test-bcrypt-pepper-min-32-chars",
            CRYPT0_SECRET: "0123456789abcdef0123456789abcdef",
            CLUSTER_WORKERS: DEFAULT_CLUSTER_WORKERS,
        });
    });

    it("should coerce numeric and boolean environment strings", () => {
        const {value, error} = createEnvSchema(true).validate({
            PORT: "8080",
            CLUSTER_WORKERS: "3",
            METRICS_ENABLED: "false",
            DB_POOL_MAX: "20",
        });

        expect(error).toBeUndefined();
        expect(value).toMatchObject({
            PORT: 8080,
            CLUSTER_WORKERS: 3,
            METRICS_ENABLED: false,
            DB_POOL_MAX: 20,
        });
    });

    it("should reject values outside the documented ranges", () => {
        const {error} = createEnvSchema(true).validate(
            {
                NODE_ENV: "staging",
                PORT: 0,
                DB_PORT: 70_000,
                CLUSTER_WORKERS: 0,
            },
            {abortEarly: false},
        );

        expect(error).toBeDefined();
        expect(error!.details.map((detail) => detail.path.join(".")))
            .toEqual(
                expect.arrayContaining([
                    "NODE_ENV",
                    "PORT",
                    "DB_PORT",
                    "CLUSTER_WORKERS",
                ]),
            );
    });

    it("should allow unknown environment variables", () => {
        const {value, error} = createEnvSchema(true).validate({
            PATH: "/usr/bin",
            VITEST: "true",
            CUSTOM_VARIABLE: "allowed",
        });

        expect(error).toBeUndefined();
        expect(value.CUSTOM_VARIABLE).toBe("allowed");
    });
});

describe("normalizeEnvironment", () => {
    it("should remove empty values and preserve the rest", () => {
        const source = {
            KEEP: "value",
            REMOVE: "",
            ALSO_REMOVE: "",
        };

        const normalized = normalizeEnvironment(source);

        expect(normalized).toEqual({KEEP: "value"});
        expect(source).toEqual({
            KEEP: "value",
            REMOVE: "",
            ALSO_REMOVE: "",
        });
    });

    it("should return a copy rather than mutating process.env", () => {
        const normalized = normalizeEnvironment();

        expect(normalized).not.toBe(process.env);
        expect(
            Object.values(normalized).every((value) => value !== ""),
        ).toBe(true);
    });
});

describe("isLoopbackHost", () => {
    it("should recognise loopback hosts", () => {
        expect(isLoopbackHost("localhost")).toBe(true);
        expect(isLoopbackHost("127.0.0.1")).toBe(true);
        expect(isLoopbackHost("::1")).toBe(true);
        expect(isLoopbackHost("0.0.0.0")).toBe(true);
    });

    it("should reject non-loopback hosts", () => {
        expect(isLoopbackHost("db.example.com")).toBe(false);
        expect(isLoopbackHost("10.0.0.1")).toBe(false);
        expect(isLoopbackHost("")).toBe(false);
    });
});

describe("validateProductionConfig", () => {
    it("should accept a complete, TLS-enabled production configuration", () => {
        expect(() =>
            validateProductionConfig(
                validProductionEnv,
                validProductionSourceEnv,
            ),
        ).not.toThrow();
    });

    it("should allow loopback dependencies without TLS", () => {
        expect(() =>
            validateProductionConfig(
                {
                    ...validProductionEnv,
                    DB_HOST: "localhost",
                    DB_SSL: false,
                    REDIS_HOST: "127.0.0.1",
                    REDIS_TLS: false,
                },
                {
                    ...validProductionSourceEnv,
                    DB_HOST: "localhost",
                },
            ),
        ).not.toThrow();
    });

    it("should allow email to be disabled without a SendGrid key", () => {
        const sourceEnv = {...validProductionSourceEnv};
        delete sourceEnv.SENDGRID_API_KEY;

        expect(() =>
            validateProductionConfig(
                {
                    ...validProductionEnv,
                    EMAIL_ENABLED: false,
                },
                sourceEnv,
            ),
        ).not.toThrow();
    });

    it("should fail closed when secrets, CORS and database settings are missing", () => {
        expect(() =>
            validateProductionConfig(
                {DB_SSL: false, DB_HOST: "", EMAIL_ENABLED: true},
                {},
            ),
        ).toThrowError(
            expect.objectContaining({
                message: expect.stringContaining(
                    "Production configuration validation failed",
                ),
            }),
        );

        try {
            validateProductionConfig(
                {DB_SSL: false, DB_HOST: "", EMAIL_ENABLED: true},
                {},
            );
        } catch (error) {
            const message = (error as Error).message;

            expect(message).toContain("JWT_SECRET");
            expect(message).toContain("BCRYPT_SECRET");
            expect(message).toContain("CRYPT0_SECRET");
            expect(message).toContain("CORS_ORIGINS");
            expect(message).toContain("Database configuration");
            expect(message).toContain("SENDGRID_API_KEY");
            expect(message).toContain("DB_SSL");
        }
    });

    it("should require TLS for a non-loopback Redis host", () => {
        expect(() =>
            validateProductionConfig(
                {...validProductionEnv, REDIS_TLS: false},
                validProductionSourceEnv,
            ),
        ).toThrowError(/REDIS_TLS/);
    });

    it("should require a SendGrid key when email is enabled", () => {
        const sourceEnv = {...validProductionSourceEnv};
        delete sourceEnv.SENDGRID_API_KEY;

        expect(() =>
            validateProductionConfig(
                validProductionEnv,
                sourceEnv,
            ),
        ).toThrowError(/SENDGRID_API_KEY/);
    });
});
