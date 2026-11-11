"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const db_error_mapper_1 = require("./db-error.mapper");
const errors_1 = require("./errors");
/**
 * Builds an error that looks like a PostgreSQL driver error.
 */
const pgError = (code, extra = {}) => Object.assign(new Error("Database error"), Object.assign({ code }, extra));
(0, vitest_1.describe)("mapDatabaseError", () => {
    (0, vitest_1.it)("returns null for a non-database error", () => {
        (0, vitest_1.expect)((0, db_error_mapper_1.mapDatabaseError)(new Error("boom"))).toBeNull();
        (0, vitest_1.expect)((0, db_error_mapper_1.mapDatabaseError)("a string")).toBeNull();
        (0, vitest_1.expect)((0, db_error_mapper_1.mapDatabaseError)(null)).toBeNull();
        (0, vitest_1.expect)((0, db_error_mapper_1.mapDatabaseError)(undefined)).toBeNull();
    });
    (0, vitest_1.it)("maps a unique violation to 409", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("23505", { constraint: "users_username_key" }));
        (0, vitest_1.expect)(error).toBeInstanceOf(errors_1.AppError);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(409);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.errorCode).toBe("DUPLICATE_DATA");
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.message).toContain("username");
    });
    (0, vitest_1.it)("maps a unique violation without a usable constraint to a generic 409", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("23505"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(409);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.message).not.toContain("constraint");
    });
    (0, vitest_1.it)("extracts the constraint from the message when it is not a field", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
            code: "23505",
        }));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.message).toContain("email");
    });
    (0, vitest_1.it)("maps a foreign-key violation to 409", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("23503"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(409);
    });
    (0, vitest_1.it)("maps a not-null violation to 422", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("23502"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(422);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.errorCode).toBe("VALIDATION_FAILED");
    });
    (0, vitest_1.it)("maps a check violation to 422", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("23514"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(422);
    });
    (0, vitest_1.it)("maps a serialization failure to a retryable server error", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("40001"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(500);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.message).toContain("retry");
    });
    (0, vitest_1.it)("maps a deadlock to a retryable server error", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("40P01"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(500);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.message).toContain("retry");
    });
    (0, vitest_1.it)("maps a cancelled query to a server error", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("57014"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(500);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.message).toContain("cancelled");
    });
    (0, vitest_1.it)("maps a connection failure to 503", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("ECONNREFUSED"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(503);
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.errorCode).toBe("SERVICE_UNAVAILABLE");
    });
    (0, vitest_1.it)("maps a too-many-connections failure to 503", () => {
        const error = (0, db_error_mapper_1.mapDatabaseError)(pgError("53300"));
        (0, vitest_1.expect)(error === null || error === void 0 ? void 0 : error.statusCode).toBe(503);
    });
    (0, vitest_1.it)("returns null for an unmapped database code", () => {
        (0, vitest_1.expect)((0, db_error_mapper_1.mapDatabaseError)(pgError("42P01"))).toBeNull();
    });
});
