// database/migrations/20250313141537_roles.ts
import type {Kysely} from "kysely";
import {sql} from "kysely";

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
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("roles").execute();
}
