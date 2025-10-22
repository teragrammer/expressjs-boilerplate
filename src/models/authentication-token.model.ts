import {Knex} from "knex";
import jwt, {JwtPayload} from "jsonwebtoken";
import {DateUtil} from "../utilities/date.util";
import {UserInterface} from "../interfaces/user.interface";
import {__ENV} from "../configurations/env";

const TABLE_NAME = "authentication_tokens";

const JWT_TFA = __ENV.JWT_TFA;
const JWT_SECRET = __ENV.JWT_SECRET;
const JWT_EXPIRATION_DAYS = __ENV.JWT_EXPIRATION_DAYS;

export interface JwtExtendedPayload extends JwtPayload {
    uid: number;        // user id
    fnm: string;        // first name
    mnm: string | null; // middle name
    lnm: string | null; // last name
    rol?: string;       // role slug
    unm: string | null; // username
    eml: string | null; // email
    phn: string | null; // phone
    tid: number;        // token id
    tfa: string;        // two-factor authentication status
}

export function AuthenticationTokenModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),

        hidden(user: UserInterface) {
            delete user.password;
            delete user.failed_login_expired_at;
            delete user.login_tries;
        },

        async generate(user: UserInterface) {
            // remove private data
            this.hidden(user);

            // delete expired tokens
            await this.clean(user.id);

            // generate a new token
            const token = await this.token(user);

            return {
                user,
                token,
            };
        },

        async token(user: UserInterface, tfa?: string): Promise<string> {
            const expiredAt = DateUtil().expiredAt(JWT_EXPIRATION_DAYS / 86400, "days");
            const data: any = {
                user_id: user.id,
                created_at: DateUtil().sql(),
                expired_at: DateUtil().sql(expiredAt),
            };
            let id: any = await knex.table(TABLE_NAME).returning("id").insert(data);
            if (!id.length) throw new Error("Unable to create a new token");

            const payload: JwtExtendedPayload = {
                uid: user.id,
                fnm: user.first_name,
                mnm: user.middle_name,
                lnm: user.last_name,
                rol: user.role_slug,
                unm: user.username,
                eml: user.email,
                phn: user.phone,
                tid: id[0],
                tfa: tfa !== undefined ? tfa : (JWT_TFA ? "hol" : "con"),
            };

            return jwt.sign(payload, JWT_SECRET, {expiresIn: JWT_EXPIRATION_DAYS});
        },

        async validate(token: string): Promise<JwtExtendedPayload | boolean> {
            if (!token) return false;

            try {
                const decoded = jwt.verify(token, JWT_SECRET);

                // Ensure it's a JwtExtendedPayload (not just a string)
                if (typeof decoded === "object") return decoded as JwtExtendedPayload;

                return false;
            } catch (error: any) {
                return false;
            }
        },

        async clean(userId: number, expiredOnly = true) {
            if (expiredOnly) {
                return knex.table(TABLE_NAME)
                    .where("user_id", userId)
                    .where("expired_at", "<", DateUtil().sql())
                    .delete();
            }

            return knex.table(TABLE_NAME)
                .where("user_id", userId)
                .delete();
        },
    };
}