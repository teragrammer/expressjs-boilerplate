import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // Add authorization_version column to users table
    await db.schema
        .alterTable("users")
        .addColumn("authorization_version", "integer", (col) =>
            col.notNull().defaultTo(0)
        )
        .execute();

    // Create index for authorization version lookups
    await db.schema
        .createIndex("idx_users_authorization_version")
        .on("users")
        .column("authorization_version")
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Drop the index
    await db.schema
        .dropIndex("idx_users_authorization_version")
        .execute();

    // Drop the column
    await db.schema
        .alterTable("users")
        .dropColumn("authorization_version")
        .execute();
}