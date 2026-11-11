import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Drop the existing FK constraint with CASCADE
    await db.schema
        .alterTable("users")
        .dropConstraint("users_role_id_fk")
        .execute();

    // Add new FK constraint with RESTRICT
    await db.schema
        .alterTable("users")
        .addForeignKeyConstraint("users_role_id_fk", ["role_id"], "roles", ["id"], (cb) =>
            cb.onUpdate("cascade").onDelete("restrict"),
        )
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop the RESTRICT constraint
    await db.schema
        .alterTable("users")
        .dropConstraint("users_role_id_fk")
        .execute();

    // Restore the CASCADE constraint
    await db.schema
        .alterTable("users")
        .addForeignKeyConstraint("users_role_id_fk", ["role_id"], "roles", ["id"], (cb) =>
            cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();
}