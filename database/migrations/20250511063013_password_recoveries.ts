// database/migrations/20250511063013_password_recoveries.ts
import type {Kysely} from "kysely";
import {sql} from "kysely";
import {TYPES} from "../../src/modules/auth/interfaces/password.recovery.interface";

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
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("password_recoveries").execute();
}
