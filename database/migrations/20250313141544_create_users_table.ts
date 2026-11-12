// database/migrations/20250313141544_users.ts
import {sql, type Kysely} from "kysely";
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
        .addColumn("authorization_version", "integer", (col) =>
            col.notNull().defaultTo(0),
        )
        .addColumn("created_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("updated_at", "timestamptz", (col) =>
            col.notNull().defaultTo(sql`now()`),
        )
        .addColumn("deleted_at", "timestamptz")
        .addForeignKeyConstraint("users_role_id_fk", ["role_id"], "roles", ["id"], (cb) =>
            cb.onUpdate("cascade").onDelete("restrict"),
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

    await db.schema
        .createIndex("idx_users_browse_role_status")
        .on("users")
        .columns(["deleted_at", "role_id", "status", "id"])
        .execute();

    await db.schema
        .createIndex("idx_users_browse_status")
        .on("users")
        .columns(["deleted_at", "status", "id"])
        .execute();

    await db.schema
        .createIndex("idx_users_browse_role")
        .on("users")
        .columns(["deleted_at", "role_id", "id"])
        .execute();

    await db.schema
        .createIndex("idx_users_deleted_id")
        .on("users")
        .columns(["deleted_at", "id"])
        .execute();

    await db.schema
        .createIndex("idx_users_authorization_version")
        .on("users")
        .column("authorization_version")
        .execute();

    await sql`
        CREATE INDEX idx_users_search_trgm
        ON users USING gin (
            (coalesce(first_name, '') || ' ' ||
             coalesce(middle_name, '') || ' ' ||
             coalesce(last_name, '') || ' ' ||
             coalesce(username, '') || ' ' ||
             coalesce(email, '') || ' ' ||
             coalesce(phone, '')) gin_trgm_ops
        )
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await sql`DROP INDEX IF EXISTS idx_users_search_trgm;`.execute(db);
    await db.schema.dropIndex("idx_users_authorization_version").execute();
    await db.schema.dropIndex("idx_users_deleted_id").execute();
    await db.schema.dropIndex("idx_users_browse_role").execute();
    await db.schema.dropIndex("idx_users_browse_status").execute();
    await db.schema.dropIndex("idx_users_browse_role_status").execute();
    await db.schema.dropTable("users").execute();
}
