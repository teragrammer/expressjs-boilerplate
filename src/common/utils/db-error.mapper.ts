// src/common/utils/db-error.mapper.ts
import {AppError} from "./errors";
import Messages from "./messages";

/**
 * PostgreSQL SQLSTATE codes that need a stable API mapping.
 *
 * @see https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";
const PG_NOT_NULL_VIOLATION = "23502";
const PG_CHECK_VIOLATION = "23514";
const PG_SERIALIZATION_FAILURE = "40001";
const PG_DEADLOCK_DETECTED = "40P01";
const PG_QUERY_CANCELED = "57014";

/**
 * Connection-level failures that should surface as a temporary
 * unavailability rather than a server bug.
 */
const CONNECTION_ERROR_CODES = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EPIPE",
    "ETIMEDOUT",
    "EHOSTUNREACH",
    "ENOTFOUND",
    "57P01", // admin_shutdown
    "57P02", // crash_shutdown
    "57P03", // cannot_connect_now
    "53300", // too_many_connections
]);

/**
 * A database error that carries a PostgreSQL SQLSTATE code.
 */
interface PostgresError extends Error {
    code?: string;
    constraint?: string;
    detail?: string;
    table?: string;
    column?: string;
}

function isPostgresError(error: unknown): error is PostgresError {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as {code?: unknown}).code === "string"
    );
}

/**
 * Extracts the constraint name from a PostgreSQL error message.
 *
 * Used only to decide which field to report; the raw constraint name
 * is never returned to the client.
 */
function extractConstraint(error: PostgresError): string | undefined {
    if (error.constraint) {
        return error.constraint;
    }

    const match = /constraint "([^"]+)"/.exec(error.message ?? "");

    return match?.[1];
}

/**
 * Maps a unique-constraint name to the client-facing field name.
 */
function mapConstraintToField(constraint?: string): string | undefined {
    if (!constraint) {
        return undefined;
    }

    if (constraint.includes("username")) {return "username";}
    if (constraint.includes("email")) {return "email";}
    if (constraint.includes("phone")) {return "phone";}
    if (constraint.includes("slug")) {return "slug";}
    if (constraint.includes("name")) {return "name";}
    if (constraint.includes("route")) {return "route";}
    if (constraint.includes("role")) {return "role_id";}

    return undefined;
}

/**
 * Translates a PostgreSQL driver error into a stable API error.
 *
 * The response never contains SQL text, table names, column names or
 * constraint names: only a machine-readable code and a safe message.
 *
 * Returns `null` when the error is not a database error, so callers can
 * fall through to the generic handler.
 */
export function mapDatabaseError(error: unknown): AppError | null {
    if (!isPostgresError(error)) {
        return null;
    }

    const code = error.code as string;

    switch (code) {
        case PG_UNIQUE_VIOLATION: {
            const field = mapConstraintToField(extractConstraint(error));

            return new AppError(
                Messages.DUPLICATE_DATA,
                field
                    ? `The value provided for '${field}' is already in use.`
                    : "The data you've selected is already assigned",
            );
        }

        case PG_FOREIGN_KEY_VIOLATION: {
            return new AppError(
                Messages.DUPLICATE_DATA,
                "The request references a resource that is still in use or does not exist.",
            );
        }

        case PG_NOT_NULL_VIOLATION:
        case PG_CHECK_VIOLATION: {
            return new AppError(
                Messages.VALIDATION_FAILED,
                "One or more required fields are missing or invalid.",
            );
        }

        case PG_SERIALIZATION_FAILURE:
        case PG_DEADLOCK_DETECTED: {
            return new AppError(
                Messages.SERVER_ERROR,
                "The request could not be completed due to a concurrent update. Please retry.",
            );
        }

        case PG_QUERY_CANCELED: {
            return new AppError(
                Messages.SERVER_ERROR,
                "The request took too long to complete and was cancelled.",
            );
        }

        default:
            break;
    }

    if (CONNECTION_ERROR_CODES.has(code)) {
        return new AppError(
            Messages.SERVICE_UNAVAILABLE,
            "The service is temporarily unavailable. Please retry shortly.",
        );
    }

    return null;
}
