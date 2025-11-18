import {Knex} from "knex";
import {DBKnex} from "../configurations/knex";

export const PASSWORD_RECOVERY_TABLE = "password_recoveries";

export const RECOVERY_EMAIL = "email";
export const RECOVERY_PHONE = "phone";
export const TYPES: string[] = [RECOVERY_EMAIL, RECOVERY_PHONE];

export function PasswordRecoveryModel(knex?: Knex) {
    return {
        table: () => (knex ? knex : DBKnex).table(PASSWORD_RECOVERY_TABLE),
    };
}