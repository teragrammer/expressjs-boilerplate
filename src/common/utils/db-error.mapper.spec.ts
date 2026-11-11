import {describe, expect, it} from "vitest";
import {mapDatabaseError} from "./db-error.mapper";
import {AppError} from "./errors";

/**
 * Builds an error that looks like a PostgreSQL driver error.
 */
const pgError = (code: string, extra: Record<string, unknown> = {}) =>
    Object.assign(new Error("Database error"), {code, ...extra});

describe("mapDatabaseError", () => {
    it("returns null for a non-database error", () => {
        expect(mapDatabaseError(new Error("boom"))).toBeNull();
        expect(mapDatabaseError("a string")).toBeNull();
        expect(mapDatabaseError(null)).toBeNull();
        expect(mapDatabaseError(undefined)).toBeNull();
    });

    it("maps a unique violation to 409", () => {
        const error = mapDatabaseError(
            pgError("23505", {constraint: "users_username_key"}),
        );

        expect(error).toBeInstanceOf(AppError);
        expect(error?.statusCode).toBe(409);
        expect(error?.errorCode).toBe("DUPLICATE_DATA");
        expect(error?.message).toContain("username");
    });

    it("maps a unique violation without a usable constraint to a generic 409", () => {
        const error = mapDatabaseError(pgError("23505"));

        expect(error?.statusCode).toBe(409);
        expect(error?.message).not.toContain("constraint");
    });

    it("extracts the constraint from the message when it is not a field", () => {
        const error = mapDatabaseError(
            Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
                code: "23505",
            }),
        );

        expect(error?.message).toContain("email");
    });

    it("maps a foreign-key violation to 409", () => {
        const error = mapDatabaseError(pgError("23503"));

        expect(error?.statusCode).toBe(409);
    });

    it("maps a not-null violation to 422", () => {
        const error = mapDatabaseError(pgError("23502"));

        expect(error?.statusCode).toBe(422);
        expect(error?.errorCode).toBe("VALIDATION_FAILED");
    });

    it("maps a check violation to 422", () => {
        const error = mapDatabaseError(pgError("23514"));

        expect(error?.statusCode).toBe(422);
    });

    it("maps a serialization failure to a retryable server error", () => {
        const error = mapDatabaseError(pgError("40001"));

        expect(error?.statusCode).toBe(500);
        expect(error?.message).toContain("retry");
    });

    it("maps a deadlock to a retryable server error", () => {
        const error = mapDatabaseError(pgError("40P01"));

        expect(error?.statusCode).toBe(500);
        expect(error?.message).toContain("retry");
    });

    it("maps a cancelled query to a server error", () => {
        const error = mapDatabaseError(pgError("57014"));

        expect(error?.statusCode).toBe(500);
        expect(error?.message).toContain("cancelled");
    });

    it("maps a connection failure to 503", () => {
        const error = mapDatabaseError(pgError("ECONNREFUSED"));

        expect(error?.statusCode).toBe(503);
        expect(error?.errorCode).toBe("SERVICE_UNAVAILABLE");
    });

    it("maps a too-many-connections failure to 503", () => {
        const error = mapDatabaseError(pgError("53300"));

        expect(error?.statusCode).toBe(503);
    });

    it("returns null for an unmapped database code", () => {
        expect(mapDatabaseError(pgError("42P01"))).toBeNull();
    });
});
