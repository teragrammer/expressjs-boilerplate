import {Knex} from "knex";
import jwt, {JwtPayload} from 'jsonwebtoken';
import {DateUtil} from "../utilities/date.util";
import {UserInterface} from "../interfaces/user.interface";
import {RoleModel} from "./role.model";
import {__ENV} from "../configurations/env";

const TABLE_NAME = 'authentication_tokens';

const JWT_TFA = __ENV.JWT_TFA;
const JWT_SECRET = __ENV.JWT_SECRET;
const JWT_EXPIRATION_DAYS = __ENV.JWT_EXPIRATION_DAYS;

export function AuthenticationTokenModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),

        hidden(user: UserInterface) {
            delete user.password;
            delete user.failed_login_expired_at;
            delete user.login_tries;
        },

        async generate(user: UserInterface) {
            // add role details
            user.role = await RoleModel(knex).table().where('id', user.role_id).first();

            // remove private data
            this.hidden(user);

            // delete expired tokens
            await this.clean(user.id);

            // generate a new token
            const token = await this.token(user);

            return {
                user,
                token,
            }
        },

        async token(user: UserInterface, tfa?: string): Promise<string> {
            const expiredAt = DateUtil().expiredAt(JWT_EXPIRATION_DAYS / 86400, 'days');
            const data: any = {
                user_id: user.id,
                created_at: DateUtil().sql(),
                expired_at: DateUtil().sql(expiredAt),
            };
            let id: any = await knex.table(TABLE_NAME).returning('id').insert(data);
            if (!id.length) throw new Error('Unable to create a new token');

            const payload = {
                uid: user.id,
                rol: user.role?.slug,
                unm: user.username,
                eml: user.email,
                phn: user.phone,
                tid: id[0],
                tfa: tfa !== undefined ? tfa : (JWT_TFA ? 'hol' : 'con'),
            };

            return jwt.sign(payload, JWT_SECRET, {expiresIn: JWT_EXPIRATION_DAYS});
        },

        async validate(token: string): Promise<JwtPayload | boolean> {
            if (!token) return false;

            try {
                const decoded = jwt.verify(token, JWT_SECRET);

                // Ensure it's a JwtPayload (not just a string)
                if (typeof decoded === 'object') {
                    return decoded as JwtPayload;
                }

                return false;
            } catch (error: any) {
                return false;
            }
        },

        async clean(userId: number, expiredOnly = true) {
            if (expiredOnly) {
                return knex.table(TABLE_NAME)
                    .where('user_id', userId)
                    .where('expired_at', '<', DateUtil().sql())
                    .delete();
            }

            return knex.table(TABLE_NAME)
                .where('user_id', userId)
                .delete();
        },
    }
}