// database/migrations/20251023075024_route_guards.ts
import type {Kysely} from "kysely";
import {sql} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("route_guards")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("role_id", "integer", (col) => col.notNull())
        .addColumn("route", "varchar(100)", (col) => col.notNull())
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addForeignKeyConstraint("route_guards_role_id_fk", ["role_id"], "roles", ["id"], (cb) =>
            cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("route_guards").execute();
}
