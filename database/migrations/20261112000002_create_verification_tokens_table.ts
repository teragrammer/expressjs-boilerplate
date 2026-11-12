// database/migrations/20261112000002_create_verification_tokens_table.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("verification_tokens")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("channel", "varchar(20)", (col) => col.notNull())
        .addColumn("target", "varchar(180)", (col) => col.notNull())
        .addColumn("token_hash", "varchar(128)", (col) => col.notNull().unique())
        .addColumn("expires_at", "timestamptz", (col) => col.notNull())
        .addColumn("consumed_at", "timestamptz")
        .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addCheckConstraint(
            "verification_tokens_channel_check",
            sql`channel in ('email', 'phone')`,
        )
        .addForeignKeyConstraint(
            "verification_tokens_user_id_fk",
            ["user_id"],
            "users",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createIndex("idx_verification_tokens_user_channel")
        .on("verification_tokens")
        .columns(["user_id", "channel"])
        .execute();

    await db.schema
        .createIndex("idx_verification_tokens_expires_at")
        .on("verification_tokens")
        .column("expires_at")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("verification_tokens").execute();
}
