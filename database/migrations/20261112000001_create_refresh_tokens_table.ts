// database/migrations/20261112000001_add_refresh_tokens.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("refresh_tokens")
        .addColumn("id", "uuid", (col) =>
            col.primaryKey().defaultTo(sql`gen_random_uuid()`),
        )
        .addColumn("session_id", "integer", (col) => col.notNull())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("token_hash", "varchar(128)", (col) => col.notNull().unique())
        .addColumn("family_id", "uuid", (col) => col.notNull())
        .addColumn("expires_at", "timestamptz", (col) => col.notNull())
        .addColumn("revoked_at", "timestamptz")
        .addColumn("replaced_by", "uuid")
        .addColumn("ip", "varchar(100)")
        .addColumn("user_agent", "varchar(255)")
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addForeignKeyConstraint(
            "refresh_tokens_session_id_fk",
            ["session_id"],
            "authentication_tokens",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .addForeignKeyConstraint(
            "refresh_tokens_user_id_fk",
            ["user_id"],
            "users",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createIndex("idx_refresh_tokens_family_id")
        .on("refresh_tokens")
        .column("family_id")
        .execute();

    await db.schema
        .createIndex("idx_refresh_tokens_user_id")
        .on("refresh_tokens")
        .column("user_id")
        .execute();

    await db.schema
        .createIndex("idx_refresh_tokens_expires_at")
        .on("refresh_tokens")
        .column("expires_at")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("refresh_tokens").execute();
}
