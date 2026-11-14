// database/migrations/20261114000001_add_verification_state_columns.ts
import {sql, type Kysely} from "kysely";

/**
 * Separates the three states a verification token can be in:
 *
 * - pending: no timestamp set;
 * - invalidated: superseded by a newer token or a profile change;
 * - verified: successfully confirmed by the owner of the target.
 *
 * Historically `consumed_at` was used for both invalidation and
 * success, which made an unconfirmed resend look like a verification.
 */
export async function up(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("verification_tokens")
        .addColumn("verified_at", "timestamptz")
        .addColumn("invalidated_at", "timestamptz")
        .execute();

    /*
     * Preserve historical confirmations only when the verified target
     * still matches the profile and the profile flag is set. Every
     * other consumed row was an invalidation, not a success.
     */
    await sql`
        UPDATE verification_tokens vt
        SET verified_at = vt.consumed_at
        FROM users u
        WHERE vt.consumed_at IS NOT NULL
          AND vt.user_id = u.id
          AND (
              (vt.channel = 'email'
                  AND vt.target = u.email
                  AND u.is_email_verified)
              OR
              (vt.channel = 'phone'
                  AND vt.target = u.phone
                  AND u.is_phone_verified)
          )
    `.execute(db);

    await sql`
        UPDATE verification_tokens
        SET invalidated_at = consumed_at
        WHERE consumed_at IS NOT NULL
          AND verified_at IS NULL
    `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
    await db.schema
        .alterTable("verification_tokens")
        .dropColumn("verified_at")
        .dropColumn("invalidated_at")
        .execute();
}
