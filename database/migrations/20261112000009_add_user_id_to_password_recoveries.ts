// database/migrations/20261112000009_add_user_id_to_password_recoveries.ts
import {sql, type Kysely} from "kysely";

/**
 * Links a recovery record to the account it belongs to.
 *
 * Without the link, changing a password cannot invalidate the
 * outstanding recovery codes, and cleanup cannot scope deletions to a
 * single user.
 */
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("password_recoveries")
        .addColumn("user_id", "integer")
        .execute();

    /*
     * Backfill existing rows by matching the recovery target against
     * the user email/phone columns.
     */
    await sql`
        UPDATE password_recoveries pr
        SET user_id = u.id
        FROM users u
        WHERE pr.user_id IS NULL
          AND pr.type = 'email'
          AND u.email = pr.send_to
    `.execute(db);

    await sql`
        UPDATE password_recoveries pr
        SET user_id = u.id
        FROM users u
        WHERE pr.user_id IS NULL
          AND pr.type = 'phone'
          AND u.phone = pr.send_to
    `.execute(db);

    await db.schema
        .alterTable("password_recoveries")
        .addForeignKeyConstraint(
            "password_recoveries_user_id_fk",
            ["user_id"],
            "users",
            ["id"],
            (cb) => cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();

    await db.schema
        .createIndex("idx_password_recoveries_user_id")
        .on("password_recoveries")
        .column("user_id")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema.dropIndex("idx_password_recoveries_user_id").execute();

    await db.schema
        .alterTable("password_recoveries")
        .dropConstraint("password_recoveries_user_id_fk")
        .execute();

    await db.schema
        .alterTable("password_recoveries")
        .dropColumn("user_id")
        .execute();
}
