// src/common/utils/sql-like.ts
/**
 * Escapes PostgreSQL LIKE wildcards.
 *
 * Free-text search input must never change the meaning of a LIKE
 * pattern, so backslash, percent and underscore are escaped before the
 * value is wrapped in `%...%`.
 */
export function escapeLikePattern(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_");
}
