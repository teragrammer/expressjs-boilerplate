// database/migrations/20250313141523_settings.ts
import type {Kysely} from "kysely";
import {sql} from "kysely";
import {DATA_TYPES} from "../../src/modules/system/settings/setting.model";

const TYPE_CHECK_VALUES = DATA_TYPES.map((type) => `'${type}'`).join(", ");

export async function up(db: Kysely<any>): Promise<void> {
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
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("settings").execute();
}
