// database/migrations/20261112000008_add_settings_roles_browse_indexes.ts
import {sql, type Kysely} from "kysely";

/**
 * Browse indexes for the admin tables.
 *
 * See migration 20261112000007 for why these are not created with
 * `CONCURRENTLY`.
 */
export async function up(db: Kysely<any>): Promise<void> {
    await sql`
        CREATE INDEX IF NOT EXISTS idx_settings_browse
        ON settings (is_disabled, is_public, id)
    `.execute(db);

    await sql`
        CREATE INDEX IF NOT EXISTS idx_roles_browse
        ON roles (is_public, id)
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS idx_roles_browse;`.execute(db);
    await sql`DROP INDEX IF EXISTS idx_settings_browse;`.execute(db);
}
