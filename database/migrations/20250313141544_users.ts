// database/migrations/20250313141544_users.ts
import type {Kysely} from "kysely";
import {sql} from "kysely";
import {GENDERS, STATUSES} from "../../src/modules/users/user.interface";

const GENDER_CHECK_VALUES = GENDERS.map((gender) => `'${gender}'`).join(", ");
const STATUS_CHECK_VALUES = STATUSES.map((status) => `'${status}'`).join(", ");

export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .createTable("users")
        .addColumn("id", "serial", (col) => col.primaryKey())
        .addColumn("first_name", "varchar(100)")
        .addColumn("middle_name", "varchar(100)")
        .addColumn("last_name", "varchar(100)")
        .addColumn("gender", "varchar(10)")
        .addColumn("address", "text")
        .addColumn("phone", "varchar(22)", (col) => col.unique())
        .addColumn("is_phone_verified", "boolean", (col) =>
            col.notNull().defaultTo(false),
        )
        .addColumn("email", "varchar(180)", (col) => col.unique())
        .addColumn("is_email_verified", "boolean", (col) =>
            col.notNull().defaultTo(false),
        )
        .addColumn("has_tfa", "boolean", (col) =>
            col.notNull().defaultTo(false),
        )
        .addColumn("tfa_secret", "varchar(100)")
        .addColumn("role_id", "integer", (col) => col.notNull())
        .addColumn("username", "varchar(16)", (col) => col.unique())
        .addColumn("password", "text")
        .addColumn("status", "varchar(20)", (col) =>
            col.notNull().defaultTo("Activated"),
        )
        .addColumn("login_tries", "integer", (col) =>
            col.notNull().defaultTo(0),
        )
        .addColumn("failed_login_expired_at", "timestamptz")
        .addColumn("comments", "text")
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("deleted_at", "timestamptz")
        .addForeignKeyConstraint("users_role_id_fk", ["role_id"], "roles", ["id"], (cb) =>
            cb.onUpdate("cascade").onDelete("cascade"),
        )
        .addCheckConstraint(
            "users_gender_check",
            sql`gender is null or gender in (${sql.raw(GENDER_CHECK_VALUES)})`,
        )
        .addCheckConstraint(
            "users_status_check",
            sql`status in (${sql.raw(STATUS_CHECK_VALUES)})`,
        )
        .execute();

    /*
     * Browse:
     *
     * WHERE deleted_at IS NULL
     *   AND role_id = ?
     *   AND status = ?
     *   AND id < ?
     * ORDER BY id DESC
     * LIMIT ?
     */
    await db.schema
        .createIndex("idx_users_browse_role_status")
        .on("users")
        .columns(["deleted_at", "role_id", "status", "id"])
        .execute();

    /*
     * Browse:
     *
     * WHERE deleted_at IS NULL
     *   AND status = ?
     *   AND id < ?
     * ORDER BY id DESC
     * LIMIT ?
     */
    await db.schema
        .createIndex("idx_users_browse_status")
        .on("users")
        .columns(["deleted_at", "status", "id"])
        .execute();

    /*
     * Browse:
     *
     * WHERE deleted_at IS NULL
     *   AND role_id = ?
     *   AND id < ?
     * ORDER BY id DESC
     * LIMIT ?
     */
    await db.schema
        .createIndex("idx_users_browse_role")
        .on("users")
        .columns(["deleted_at", "role_id", "id"])
        .execute();

    /*
     * Supports queries that specifically filter by deleted_at.
     */
    await db.schema
        .createIndex("idx_users_deleted_id")
        .on("users")
        .columns(["deleted_at", "id"])
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropTable("users").execute();
}
