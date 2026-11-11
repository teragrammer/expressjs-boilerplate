// database/seeds/settings.ts
import type {Kysely} from "kysely";
import type {Database} from "../../src/config/schema";

/**
 * Runtime settings seed.
 *
 * The seeder is idempotent: every row is upserted by slug, so running
 * it twice updates the existing rows instead of failing on the unique
 * constraint.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
    await db
        .insertInto("settings")
        .values([
            {name: 'Max Login Tries', slug: 'mx_log_try', value: '5', type: 'integer', is_public: false},
            {name: 'Failed Login Tries Lockout Period', slug: 'lck_prd', value: '5', type: 'integer', is_public: false},
            {name: 'Authentication Token Expiration', slug: 'tkn_exp', value: '15', type: 'integer', is_public: false},
            {name: 'TFA Required', slug: 'tta_req', value: '0', type: 'boolean', is_public: false},
            {name: 'TFA Policy', slug: 'tta_policy', value: 'disabled', type: 'string', is_public: false},
            {name: 'TFA Email Sender', slug: 'tta_eml_snd', value: '', type: 'string', is_public: false},
            {name: 'TFA Email Subject', slug: 'tta_eml_sbj', value: 'Your OTP Code', type: 'string', is_public: false},
            {name: "Password Recovery Email Sender", slug: "psr_eml_snd", value: "", type: "string", is_public: false},
            {name: "Password Recovery Email Subject", slug: "psr_eml_sbj", value: "Reset Your Password - Action Required", type: "string", is_public: false},
            {name: "Verification Email Sender", slug: "ver_eml_snd", value: "", type: "string", is_public: false},
            {name: "Verification Email Subject", slug: "ver_eml_sbj", value: "Verify Your Email Address", type: "string", is_public: false},
            {name: "Email Verification Lifetime (hours)", slug: "ver_eml_ttl", value: "24", type: "integer", is_public: false},
            {name: "Phone Verification Lifetime (minutes)", slug: "ver_phn_ttl", value: "10", type: "integer", is_public: false},
            {name: "Max Verification Attempts", slug: "ver_max_try", value: "5", type: "integer", is_public: false},
            {name: "Require Verified Contact For Recovery", slug: "ver_req_rcv", value: "0", type: "boolean", is_public: false},
        ])
        .onConflict((oc) =>
            oc.column("slug").doUpdateSet((eb) => ({
                name: eb.ref("excluded.name"),
                value: eb.ref("excluded.value"),
                type: eb.ref("excluded.type"),
                is_public: eb.ref("excluded.is_public"),
                updated_at: new Date(),
            })),
        )
        .execute();
}
