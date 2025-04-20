import {Knex} from "knex";
import {SettingModel} from "./setting.model";
import {SettingKeyValueInterface} from "../interfaces/setting-key-value.interface";
import {SecurityUtil} from "../utilities/security.util";
import {DateUtil} from "../utilities/date.util";
import {AuthenticationTokenInterface} from "../interfaces/authentication-token.interface";

const TABLE_NAME = 'authentication_tokens';

export function AuthenticationTokenModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),

        async token(userId: number): Promise<any> {
            const settings: SettingKeyValueInterface = await SettingModel(knex).value(['tkn_lth', 'tkn_exp', 'tta_req']);
            const key = SecurityUtil().randomString(settings.tkn_lth);
            const expiredAt = DateUtil().expiredAt(settings.tkn_exp, 'days');

            const data: any = {
                user_id: userId,
                token: key,
                is_tfa_required: settings.tta_req || 0,
                created_at: DateUtil().sql(),
                expired_at: DateUtil().sql(expiredAt),
            };
            let id: any = await knex.table(TABLE_NAME).returning('id').insert(data);
            if (!id.length) throw new Error('Unable to create a new token')

            // encode with base64 url
            data.id = id[0]
            data.token = SecurityUtil().encodeUrlBase64(`${userId}.${id[0]}.${key}.${DateUtil().unix(new Date(expiredAt))}`)
            return data;
        },

        async validate(token: string): Promise<AuthenticationTokenInterface | boolean> {
            if (!token) return false;

            const decoded = SecurityUtil().decodeUrlBase64(token);

            const parts: any[] = decoded.split('.');
            if (!parts.length || parts.length < 4) return false;

            const auth: AuthenticationTokenInterface = await knex.table(TABLE_NAME).where('id', parts[1]).first();
            if (!auth) return false;

            if (auth.token !== parts[2]) return false;

            if (isNaN(parts[0]) || auth.user_id !== parseInt(parts[0])) return false;

            const expiration: any = parts[3];
            if (isNaN(expiration) || parseInt(expiration) < DateUtil().unix()) return false;

            return auth;
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