// database/migrations/20261111050942_add_rate_limit_table.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("rate_limits")
        .addColumn("id", "bigserial", (col) => col.primaryKey())
        .addColumn("key", "varchar(255)", (col) => col.notNull())
        .addColumn("bucket", "varchar(100)", (col) => col.notNull())
        .addColumn("count", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("expires_at", "timestamptz", (col) => col.notNull())
        .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
        .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`now()`))
        .execute();

    await db.schema
        .createIndex("idx_rate_limits_key_bucket")
        .on("rate_limits")
        .columns(["key", "bucket"])
        .unique()
        .execute();

    await db.schema
        .createIndex("idx_rate_limits_expires_at")
        .on("rate_limits")
        .column("expires_at")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("rate_limits").execute();
}
