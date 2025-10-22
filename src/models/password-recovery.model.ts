import {Knex} from "knex";

const TABLE_NAME = "password_recoveries";

export const TYPES = ["email", "phone"];

export function PasswordRecoveryModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),
    };
}