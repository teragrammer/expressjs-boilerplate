// database/migrations/20250511063013_create_password_recoveries_table.ts
import {sql, type Kysely} from "kysely";
import {TYPES} from "../../src/modules/auth/password-recovery/password-recovery.interface";

const TYPE_CHECK_VALUES = TYPES.map((type) => `'${type}'`).join(", ");

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("password_recoveries")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("type", "varchar(20)", (col) => col.notNull())
        .addColumn("send_to", "varchar(100)", (col) => col.notNull())
        .addColumn("code", "varchar(100)", (col) => col.notNull())
        .addColumn("next_resend_at", "timestamptz", (col) => col.notNull())
        .addColumn("expired_at", "timestamptz", (col) => col.notNull())
        .addColumn("tries", "integer", (col) =>
            col.notNull().defaultTo(0),
        )
        .addColumn("next_try_at", "timestamptz")
        .addColumn("user_id", "integer")
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addUniqueConstraint("uq_password_recoveries_type_send_to", [
            "type",
            "send_to",
        ])
        .addCheckConstraint(
            "password_recoveries_type_check",
            sql`type in (${sql.raw(TYPE_CHECK_VALUES)})`,
        )
        .addForeignKeyConstraint(
            "password_recoveries_user_id_fk",
            ["user_id"],
            "users",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createIndex("idx_password_recoveries_type_send_to")
        .on("password_recoveries")
        .columns(["type", "send_to"])
        .execute();

    await db.schema
        .createIndex("idx_password_recoveries_next_resend_at")
        .on("password_recoveries")
        .column("next_resend_at")
        .execute();

    await db.schema
        .createIndex("idx_password_recoveries_expired_at")
        .on("password_recoveries")
        .column("expired_at")
        .execute();

    await db.schema
        .createIndex("idx_password_recoveries_next_try_at")
        .on("password_recoveries")
        .column("next_try_at")
        .execute();

    await db.schema
        .createIndex("idx_password_recoveries_user_id")
        .on("password_recoveries")
        .column("user_id")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("password_recoveries").execute();
}
