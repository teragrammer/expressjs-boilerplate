import {Knex} from "knex";
import {JwtPayload} from "jsonwebtoken";
import {DBKnex} from "../configurations/knex";

export const AUTHENTICATION_TOKEN_TABLE = "authentication_tokens";

export interface JwtExtendedPayload extends JwtPayload {
    uid: number;        // user id
    fnm: string;        // first name
    mnm: string | null; // middle name
    lnm: string | null; // last name
    rol?: string;       // role slug
    unm: string | null; // username
    eml: string | null; // email
    phn: string | null; // phone
    bpa?: number;       // is bypass authorization
    tid: number;        // token id
    tfa: string;        // two-factor authentication status
}

export function AuthenticationTokenModel(knex?: Knex) {
    return {
        table: () => (knex ? knex : DBKnex).table(AUTHENTICATION_TOKEN_TABLE),
    };
}