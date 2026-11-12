// database/migrations/20261112000004_create_outbox_events_table.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("outbox_events")
        .addColumn("id", "bigserial", (col) => col.primaryKey())
        .addColumn("type", "varchar(100)", (col) => col.notNull())
        .addColumn("payload", "jsonb", (col) => col.notNull().defaultTo(sql`'{}'::jsonb`))
        .addColumn("status", "varchar(20)", (col) =>
            col.notNull().defaultTo("pending"),
        )
        .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("available_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("locked_at", "timestamptz")
        .addColumn("locked_by", "varchar(100)")
        .addColumn("last_error", "text")
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("processed_at", "timestamptz")
        .addCheckConstraint(
            "outbox_events_status_check",
            sql`status in ('pending', 'processing', 'done', 'failed')`,
        )
        .execute();

    await db.schema
        .createIndex("idx_outbox_events_pending")
        .on("outbox_events")
        .columns(["status", "available_at"])
        .execute();

    await db.schema
        .createIndex("idx_outbox_events_type")
        .on("outbox_events")
        .column("type")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("outbox_events").execute();
}
