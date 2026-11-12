// database/migrations/20261112000010_add_tfa_session_state_and_recovery_codes.ts
import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("tfa_recovery_codes")
        .addColumn("id", "bigserial", (col) => col.primaryKey())
        .addColumn("user_id", "integer", (col) => col.notNull())
        .addColumn("code_hash", "varchar(255)", (col) => col.notNull())
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addForeignKeyConstraint(
            "tfa_recovery_codes_user_id_fk",
            ["user_id"],
            "users",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createIndex("idx_tfa_recovery_codes_user_id")
        .on("tfa_recovery_codes")
        .column("user_id")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("tfa_recovery_codes").execute();
}
