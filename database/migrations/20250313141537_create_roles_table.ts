// database/migrations/20250313141537_create_roles_table.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("roles")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("name", "varchar(100)", (col) => col.notNull())
        .addColumn("slug", "varchar(100)", (col) => col.notNull().unique())
        .addColumn("description", "text")
        .addColumn("is_public", "boolean", (col) =>
            col.notNull().defaultTo(false),
        )
        .addColumn("is_bypass_authorization", "boolean", (col) =>
            col.notNull().defaultTo(false),
        )
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .execute();

    await db.schema
        .createIndex("idx_roles_created_at")
        .on("roles")
        .column("created_at")
        .execute();

    await sql`
        CREATE INDEX IF NOT EXISTS idx_roles_browse
        ON roles (is_public, id)
    `.execute(db);

    await sql`
        CREATE INDEX idx_roles_search_trgm
        ON roles USING gin (
            (coalesce(name, '') || ' ' ||
             coalesce(slug, '') || ' ' ||
             coalesce(description, '')) gin_trgm_ops
        )
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS idx_roles_search_trgm;`.execute(db);
    await sql`DROP INDEX IF EXISTS idx_roles_browse;`.execute(db);
    await db.schema.dropIndex("idx_roles_created_at").execute();
    await db.schema.dropTable("roles").execute();
}
