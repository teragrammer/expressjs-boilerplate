// database/migrations/20261112000005_add_idempotency_keys.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("idempotency_keys")
        .addColumn("id", "bigserial", (col) => col.primaryKey())
        .addColumn("key", "varchar(255)", (col) => col.notNull())
        .addColumn("user_id", "integer")
        .addColumn("route", "varchar(255)", (col) => col.notNull())
        .addColumn("request_hash", "varchar(128)", (col) => col.notNull())
        .addColumn("status", "varchar(20)", (col) =>
            col.notNull().defaultTo("in_progress"),
        )
        .addColumn("response_status", "integer")
        .addColumn("response_body", "jsonb")
        .addColumn("locked_at", "timestamptz")
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("expires_at", "timestamptz", (col) => col.notNull())
        .addCheckConstraint(
            "idempotency_keys_status_check",
            sql`status in ('in_progress', 'completed')`,
        )
        .execute();

    await db.schema
        .createIndex("idx_idempotency_keys_key_route_user")
        .on("idempotency_keys")
        .columns(["key", "route", "user_id"])
        .unique()
        .execute();

    await db.schema
        .createIndex("idx_idempotency_keys_expires_at")
        .on("idempotency_keys")
        .column("expires_at")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("idempotency_keys").execute();
}
