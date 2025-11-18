import {Knex} from "knex";
import {DBKnex} from "../configurations/knex";

export const TWO_FACTOR_AUTHENTICATION_TABLE = "two_factor_authentications";

export const TFA_HOLD = "hol";
export const TFA_CONTINUE = "con";

export function TwoFactorAuthenticationModel(knex?: Knex) {
    return {
        table: () => (knex ? knex : DBKnex).table(TWO_FACTOR_AUTHENTICATION_TABLE),
    };
}