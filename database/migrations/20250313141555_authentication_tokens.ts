// database/migrations/20250313141555_authentication_tokens.ts
import type {Kysely} from "kysely";
import {sql} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("authentication_tokens")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("user_id", "integer")
        .addColumn("tries", "integer", (col) =>
            col.notNull().defaultTo(0),
        )
        .addColumn("expired_at", "timestamptz")
        .addColumn("ip", "varchar(100)")
        .addColumn("browser", "varchar(100)")
        .addColumn("os", "varchar(100)")
        .addColumn("created_at", "timestamptz", (col) =>
            col.defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.defaultTo(sql`now()`),
        )
        .addForeignKeyConstraint(
            "authentication_tokens_user_id_fk",
            ["user_id"],
            "users",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createIndex("idx_authentication_tokens_user_id")
        .on("authentication_tokens")
        .column("user_id")
        .execute();

    await db.schema
        .createIndex("idx_authentication_tokens_expired_at")
        .on("authentication_tokens")
        .column("expired_at")
        .execute();

    await db.schema
        .createIndex("idx_authentication_tokens_created_at")
        .on("authentication_tokens")
        .column("created_at")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("authentication_tokens").execute();
}
