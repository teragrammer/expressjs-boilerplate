import {Knex} from "knex";

const TABLE_NAME = "two_factor_authentications";

export function TwoFactorAuthenticationModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),
    };
}