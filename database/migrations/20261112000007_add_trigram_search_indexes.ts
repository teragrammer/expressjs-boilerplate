// database/migrations/20261112000007_add_trigram_search_indexes.ts
import {sql, type Kysely} from "kysely";

/**
 * Trigram search indexes.
 *
 * `pg_trgm` enables GIN indexes for leading-wildcard search
 * (`LIKE '%term%'`), which a plain B-tree index cannot support.
 *
 * The search columns are concatenated into a single expression so one
 * index covers the multi-column search predicate.
 *
 * NOTE: Kysely runs each migration inside a transaction, and
 * `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.
 * The indexes are therefore created non-concurrently. For a large
 * production table, apply the equivalent statements manually with
 * `CREATE INDEX CONCURRENTLY` during a maintenance window before
 * enabling the feature (see docs/runbooks/migrations.md).
 */
export async function up(db: Kysely<any>): Promise<void> {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`.execute(db);

    await sql`
        CREATE INDEX IF NOT EXISTS idx_users_search_trgm
        ON users USING gin (
            (coalesce(first_name, '') || ' ' ||
             coalesce(middle_name, '') || ' ' ||
             coalesce(last_name, '') || ' ' ||
             coalesce(username, '') || ' ' ||
             coalesce(email, '') || ' ' ||
             coalesce(phone, '')) gin_trgm_ops
        )
    `.execute(db);

    await sql`
        CREATE INDEX IF NOT EXISTS idx_roles_search_trgm
        ON roles USING gin (
            (coalesce(name, '') || ' ' ||
             coalesce(slug, '') || ' ' ||
             coalesce(description, '')) gin_trgm_ops
        )
    `.execute(db);

    await sql`
        CREATE INDEX IF NOT EXISTS idx_settings_search_trgm
        ON settings USING gin (
            (coalesce(name, '') || ' ' ||
             coalesce(slug, '') || ' ' ||
             coalesce(description, '')) gin_trgm_ops
        )
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS idx_settings_search_trgm;`.execute(db);
    await sql`DROP INDEX IF EXISTS idx_roles_search_trgm;`.execute(db);
    await sql`DROP INDEX IF EXISTS idx_users_search_trgm;`.execute(db);
}
