// database/migrations/20251023075024_route_guards.ts
import {sql, type Kysely} from "kysely";

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
            cb.onUpdate("cascade").onDelete("restrict"),
        )
        .execute();

    await db.schema
        .createIndex("idx_route_guards_role_id")
        .on("route_guards")
        .column("role_id")
        .execute();

    await db.schema
        .createIndex("idx_route_guards_role_route_unique")
        .on("route_guards")
        .columns(["role_id", "route"])
        .unique()
        .execute();

    await sql`
        ALTER TABLE route_guards
        ADD CONSTRAINT route_guards_route_not_blank
        CHECK (length(btrim(route)) > 0)
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`ALTER TABLE route_guards DROP CONSTRAINT IF EXISTS route_guards_route_not_blank;`.execute(db);
    await db.schema.dropIndex("idx_route_guards_role_route_unique").execute();
    await db.schema.dropIndex("idx_route_guards_role_id").execute();
    await db.schema.dropTable("route_guards").execute();
}
