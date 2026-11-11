import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Drop the existing FK constraint with CASCADE
    await db.schema
        .alterTable("authentication_tokens")
        .dropConstraint("authentication_tokens_user_id_fk")
        .execute();

    // Add new FK constraint with RESTRICT
    await db.schema
        .alterTable("authentication_tokens")
        .addForeignKeyConstraint("authentication_tokens_user_id_fk", ["user_id"], "users", ["id"], (cb) =>
            cb.onUpdate("cascade").onDelete("restrict"),
        )
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop the RESTRICT constraint
    await db.schema
        .alterTable("authentication_tokens")
        .dropConstraint("authentication_tokens_user_id_fk")
        .execute();

    // Restore the CASCADE constraint
    await db.schema
        .alterTable("authentication_tokens")
        .addForeignKeyConstraint("authentication_tokens_user_id_fk", ["user_id"], "users", ["id"], (cb) =>
            cb.onUpdate("cascade").onDelete("cascade"),
        )
        .execute();
}