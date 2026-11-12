// database/migrations/20250313141523_create_settings_table.ts
import {sql, type Kysely} from "kysely";
import {DATA_TYPES} from "../../src/modules/system/settings/setting.interface";

const TYPE_CHECK_VALUES = DATA_TYPES.map((type) => `'${type}'`).join(", ");

export async function up(db: Kysely<any>): Promise<void> {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm;`.execute(db);

    await db.schema
        .createTable("settings")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("name", "varchar(100)", (col) => col.notNull().unique())
        .addColumn("slug", "varchar(100)", (col) => col.notNull().unique())
        .addColumn("value", "text")
        .addColumn("description", "text")
        .addColumn("type", "varchar(20)", (col) =>
            col.notNull().defaultTo("string"),
        )
        .addColumn("is_disabled", "boolean", (col) =>
            col.notNull().defaultTo(false),
        )
        .addColumn("is_public", "boolean", (col) =>
            col.notNull().defaultTo(true),
        )
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addCheckConstraint(
            "settings_type_check",
            sql`type in (${sql.raw(TYPE_CHECK_VALUES)})`,
        )
        .execute();

    await db.schema
        .createIndex("idx_settings_browse")
        .on("settings")
        .columns(["is_disabled", "is_public", "id"])
        .execute();

    await sql`
        CREATE INDEX idx_settings_search_trgm
        ON settings USING gin (
            (coalesce(name, '') || ' ' ||
             coalesce(slug, '') || ' ' ||
             coalesce(description, '')) gin_trgm_ops
        )
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS idx_settings_search_trgm;`.execute(db);
    await db.schema.dropIndex("idx_settings_browse").execute();
    await db.schema.dropTable("settings").execute();
}
