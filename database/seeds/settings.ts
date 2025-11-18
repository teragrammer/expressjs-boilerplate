import {Knex} from "knex";

export async function seed(knex: Knex): Promise<void> {
    // Inserts seed entries
    await knex("settings").insert([
        {name: 'Max Login Tries', slug: 'mx_log_try', value: '5', type: 'integer', is_public: 0},
        {name: 'Failed Login Tries Lockout Period', slug: 'lck_prd', value: '5', type: 'integer', is_public: 0},
        {name: 'Authentication Token Expiration', slug: 'tkn_exp', value: '15', type: 'integer', is_public: 0},
        {name: 'TFA Required', slug: 'tta_req', value: '0', type: 'boolean', is_public: 0},

        {name: 'TFA Email Sender', slug: 'tta_eml_snd', value: '', type: 'string', is_public: 0},
        {name: 'TFA Email Subject', slug: 'tta_eml_sbj', value: 'Your OTP Code', type: 'string', is_public: 0},

        {name: "Password Recovery Email Sender", slug: "psr_eml_snd", value: "", type: "string", is_public: 0},
        {name: "Password Recovery Email Subject", slug: "psr_eml_sbj", value: "Reset Your Password - Action Required", type: "string", is_public: 0},
    ]);
}
