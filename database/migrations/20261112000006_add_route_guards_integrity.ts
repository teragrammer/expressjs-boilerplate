// database/migrations/20261112000006_add_route_guards_integrity.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    /*
     * Remove duplicate grants that would block the unique constraint.
     */
    await sql`
        DELETE FROM route_guards
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM route_guards
            GROUP BY role_id, route
        )
    `.execute(db);

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
}
