import {Express, Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {UserInterface} from "../../interfaces/user.interface";
import {UserModel} from "../../models/user.model";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import {SettingModel} from "../../models/setting.model";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {RoleModel} from "../../models/role.model";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";

export default (app: Express) => {
    return {
        async login(req: Request, res: Response): Promise<any> {
            const data = req.body;

            const schema = Joi.object({
                username: Joi.string().required(),
                password: Joi.string().required()
            });
            if (await ExtendJoiUtil().response(schema, data, res)) return;

            const user: UserInterface = await UserModel(app.knex).table().where('username', data.username).first();
            if (!user) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
            })

            // do not allow login if password is not set
            if (typeof user.password === 'undefined' || user.password === null) res.status(400).json({
                code: errors.e8.code,
                message: errors.e8.message,
            })

            // check if failed login tries exceed
            const expiredAt = user.failed_login_expired_at;
            if (expiredAt) {
                const loginExpiredAt = DateUtil().unix(new Date(expiredAt));
                const currentTime = DateUtil().unix();

                if (loginExpiredAt >= currentTime) {
                    // too many login attempts
                    return res.status(403).json({
                        code: errors.e9.code,
                        message: errors.e9.message,
                    })
                } else {
                    // reset failed login expiration
                    await UserModel(app.knex).table().update({failed_login_expired_at: null, login_tries: 0});
                }
            }

            if (user.password && !await SecurityUtil().compare(user.password, data.password)) {
                // increase the login attempt failed
                await UserModel(app.knex).table().where('id', user.id).increment('login_tries');

                // TODO
                // fixed mx_log_try of tkn_exp to lck_prd

                // application settings
                const settings: SettingKeyValueInterface = await SettingModel(app.knex).value(['mx_log_try', 'lck_prd']);

                // update login tries
                const totalLoginTries = (typeof Number(user.login_tries) + 1 != undefined) ? Number(user.login_tries) + 1 : 0;
                if (totalLoginTries >= settings.mx_log_try) {
                    // update the lock out period
                    await UserModel(app.knex).table().where('id', user.id).update({
                        failed_login_expired_at: DateUtil().expiredAt(settings.lck_prd, 'minutes'),
                    });

                    // too many login attempts
                    return res.status(403).json({
                        code: errors.e10.code,
                        message: errors.e10.message,
                    })
                }

                return res.status(403).json({
                    code: errors.e11.code,
                    message: errors.e11.message,
                })
            }

            const authentication = await AuthenticationTokenModel(app.knex).generate(user);

            res.status(200).json({
                user: authentication.user,
                credential: authentication.token,
            })
        },

        async logout(req: Request, res: Response): Promise<any> {
            const authentication = await AuthenticationTokenModel(app.knex).table()
                .where('id', req.credentials.authentication.id)
                .delete();

            res.status(200).json({result: authentication === 1});
        }
    }
}