// database/migrations/20250313141609_two_factor_authentications.ts
import type {Kysely} from "kysely";
import {sql} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("two_factor_authentications")
        .addColumn("id", "bigserial", (col) => col.primaryKey())
        .addColumn("token_id", "bigint", (col) => col.notNull().unique())
        .addColumn("code", "varchar(60)", (col) => col.notNull())
        .addColumn("tries", "integer", (col) =>
            col.notNull().defaultTo(0),
        )
        .addColumn("next_send_at", "timestamptz")
        .addColumn("expired_tries_at", "timestamptz")
        .addColumn("expired_at", "timestamptz")
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addForeignKeyConstraint(
            "two_factor_authentications_token_id_fk",
            ["token_id"],
            "authentication_tokens",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createIndex("idx_2fa_token_expiration")
        .on("two_factor_authentications")
        .columns(["token_id", "expired_at"])
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("two_factor_authentications").execute();
}
