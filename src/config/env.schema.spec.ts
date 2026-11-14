// src/config/env.schema.spec.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {describe, expect, it} from "vitest";

import {
    assertExplicitNodeEnv,
    createEnvSchema,
    DEFAULT_CLUSTER_WORKERS,
    findUnknownApplicationVariables,
    isLoopbackHost,
    isTestEnvironment,
    normalizeEnvironment,
    validateProductionConfig,
} from "./env.schema";

const secret = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const validProductionSourceEnv: NodeJS.ProcessEnv = {
    JWT_SECRET: secret,
    BCRYPT_SECRET: secret,
    CRYPT0_SECRET: secret,
    CORS_ORIGINS: "https://example.com",
    DB_HOST: "db.example.com",
    DB_USER: "app",
    DB_PASS: "s3cure-database-password",
    DB_NAME: "app",
    SENDGRID_API_KEY: "sendgrid-key",
    MAIL_FROM_ADDRESS: "noreply@example.com",
};

const validProductionEnv = {
    ...validProductionSourceEnv,
    EMAIL_ENABLED: true,
    DB_SSL: true,
    DB_SSL_REJECT_UNAUTHORIZED: true,
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

describe("assertExplicitNodeEnv", () => {
    it("should reject a missing NODE_ENV outside the test runner", () => {
        expect(() => assertExplicitNodeEnv({}, false)).toThrowError(
            /NODE_ENV must be explicitly set/,
        );
    });

    it("should reject an empty NODE_ENV outside the test runner", () => {
        expect(() =>
            assertExplicitNodeEnv({NODE_ENV: "   "}, false),
        ).toThrowError(/NODE_ENV must be explicitly set/);
    });

    it("should accept an explicit NODE_ENV", () => {
        expect(() =>
            assertExplicitNodeEnv({NODE_ENV: "production"}, false),
        ).not.toThrow();
    });

    it("should skip the requirement in the test runner", () => {
        expect(() => assertExplicitNodeEnv({}, true)).not.toThrow();
    });
});

describe("findUnknownApplicationVariables", () => {
    it("should report only application-looking unknown names", () => {
        const unknown = findUnknownApplicationVariables(
            {
                DB_HOST: "localhost",
                DB_POOL_MAXIMUM: "10",
                CLUSTER_WORKERS: "2",
                NODE_OPTIONS: "--max-old-space-size=512",
                PATH: "/usr/bin",
            },
            new Set(["DB_HOST", "CLUSTER_WORKERS"]),
        );

        expect(unknown).toEqual(["DB_POOL_MAXIMUM"]);
    });

    it("should return names in a deterministic order", () => {
        const unknown = findUnknownApplicationVariables(
            {
                REDIS_PORT_TYPO: "6379",
                DB_HOST_TYPO: "localhost",
            },
            new Set(),
        );

        expect(unknown).toEqual(["DB_HOST_TYPO", "REDIS_PORT_TYPO"]);
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
            METRICS_ENABLED: false,
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

    it("should require a sender address when email is enabled", () => {
        const sourceEnv = {...validProductionSourceEnv};
        delete sourceEnv.MAIL_FROM_ADDRESS;

        expect(() =>
            validateProductionConfig(
                validProductionEnv,
                sourceEnv,
            ),
        ).toThrowError(/MAIL_FROM_ADDRESS/);
    });

    it("should reject example and placeholder secrets", () => {
        const sourceEnv = {
            ...validProductionSourceEnv,
            JWT_SECRET:
                "your-super-secret-jwt-key-change-in-production-min-32-chars",
            BCRYPT_SECRET:
                "your-bcrypt-pepper-change-in-production-min-32-chars",
            CRYPT0_SECRET:
                "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            DB_PASS: "postgres",
        };

        expect(() =>
            validateProductionConfig(validProductionEnv, sourceEnv),
        ).toThrowError(/JWT_SECRET.*placeholder/);

        expect(() =>
            validateProductionConfig(validProductionEnv, sourceEnv),
        ).toThrowError(/BCRYPT_SECRET.*placeholder/);

        expect(() =>
            validateProductionConfig(validProductionEnv, sourceEnv),
        ).toThrowError(/CRYPT0_SECRET.*placeholder/);

        expect(() =>
            validateProductionConfig(validProductionEnv, sourceEnv),
        ).toThrowError(/DB_PASS.*default or placeholder/);
    });

    it("should require certificate verification when DB_SSL is enabled", () => {
        expect(() =>
            validateProductionConfig(
                {
                    ...validProductionEnv,
                    DB_SSL_REJECT_UNAUTHORIZED: false,
                },
                validProductionSourceEnv,
            ),
        ).toThrowError(/DB_SSL_REJECT_UNAUTHORIZED/);
    });

    it("should reject SEED_PASSWORD in production", () => {
        expect(() =>
            validateProductionConfig(validProductionEnv, {
                ...validProductionSourceEnv,
                SEED_PASSWORD: "a-shared-seed-password",
            }),
        ).toThrowError(/SEED_PASSWORD/);
    });

    it("should require DB certificate and key to be configured together", () => {
        expect(() =>
            validateProductionConfig(
                {
                    ...validProductionEnv,
                    DB_SSL_CERT: "/certs/client.crt",
                    DB_SSL_KEY: "",
                },
                validProductionSourceEnv,
            ),
        ).toThrowError(/DB_SSL_CERT and DB_SSL_KEY/);
    });

    it("should require REDIS certificate and key to be configured together", () => {
        expect(() =>
            validateProductionConfig(
                {
                    ...validProductionEnv,
                    REDIS_TLS_CERT: "/certs/client.crt",
                    REDIS_TLS_KEY: "",
                },
                validProductionSourceEnv,
            ),
        ).toThrowError(/REDIS_TLS_CERT and REDIS_TLS_KEY/);
    });

    it("should reject unreadable TLS files in production", () => {
        expect(() =>
            validateProductionConfig(
                {
                    ...validProductionEnv,
                    DB_SSL_CA: "/nonexistent/ca.pem",
                },
                validProductionSourceEnv,
            ),
        ).toThrowError(/DB_SSL_CA.*readable file/);
    });

    it("should accept readable TLS files in production", () => {
        const directory = fs.mkdtempSync(
            path.join(os.tmpdir(), "env-schema-"),
        );
        const caPath = path.join(directory, "ca.pem");

        fs.writeFileSync(caPath, "test-ca");

        try {
            expect(() =>
                validateProductionConfig(
                    {
                        ...validProductionEnv,
                        DB_SSL_CA: caPath,
                    },
                    validProductionSourceEnv,
                ),
            ).not.toThrow();
        } finally {
            fs.rmSync(directory, {recursive: true, force: true});
        }
    });
});
