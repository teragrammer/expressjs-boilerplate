import {sql, type Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // First, backfill NULL expired_at values with a far future date
    // (or we could set them to created_at + 7 days for existing records)
    await db
        .updateTable("authentication_tokens")
        .set({expired_at: sql<Date>`created_at + interval '7 days'`})
        .where("expired_at", "is", null)
        .execute();

    // Now make the column NOT NULL
    await db.schema
        .alterTable("authentication_tokens")
        .alterColumn("expired_at", (col) => col.setNotNull())
        .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
    // Make the column nullable again
    await db.schema
        .alterTable("authentication_tokens")
        .alterColumn("expired_at", (col) => col.dropNotNull())
        .execute();
}