import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {UserInterface} from "../../interfaces/user.interface";
import {UserModel} from "../../models/user.model";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import {SettingModel} from "../../models/setting.model";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import {Knex} from "knex";

class Controller {
    login = async (req: Request, res: Response) => {
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            username: Joi.string().required(),
            password: Joi.string().required(),
        }), DATA, res)) return;

        const KNEX: Knex = req.app.get("knex");

        const USER: UserInterface = await UserModel(KNEX).table().where("username", DATA.username).first();
        if (!USER) return res.status(404).json({
            code: errors.e3.code,
            message: errors.e3.message,
        });

        // do not allow login if password is not set
        if (typeof USER.password === "undefined" || USER.password === null) res.status(400).json({
            code: errors.e8.code,
            message: errors.e8.message,
        });

        // check if failed login tries exceed
        const EXPIRED_AT = USER.failed_login_expired_at;
        if (EXPIRED_AT) {
            const LOGIN_EXPIRED_AT = DateUtil().unix(new Date(EXPIRED_AT));
            const CURRENT_TIME = DateUtil().unix();

            if (LOGIN_EXPIRED_AT >= CURRENT_TIME) {
                // too many login attempts
                return res.status(403).json({
                    code: errors.e9.code,
                    message: errors.e9.message,
                });
            } else {
                // reset failed login expiration
                await UserModel(KNEX).table().update({failed_login_expired_at: null, login_tries: 0});
            }
        }

        if (USER.password && !await SecurityUtil().compare(USER.password, DATA.password)) {
            // increase the login attempt failed
            await UserModel(KNEX).table().where("id", USER.id).increment("login_tries");

            // application settings
            const SETTINGS: SettingKeyValueInterface = await SettingModel(KNEX).value(["mx_log_try", "lck_prd"]);

            // update login tries
            const TOTAL_LOGIN_TRIES = (typeof Number(USER.login_tries) + 1 != undefined) ? Number(USER.login_tries) + 1 : 0;
            if (TOTAL_LOGIN_TRIES >= SETTINGS.mx_log_try) {
                // update the lock out period
                await UserModel(KNEX).table().where("id", USER.id).update({
                    failed_login_expired_at: DateUtil().expiredAt(SETTINGS.lck_prd, "minutes"),
                });

                // too many login attempts
                return res.status(403).json({
                    code: errors.e10.code,
                    message: errors.e10.message,
                });
            }

            return res.status(403).json({
                code: errors.e11.code,
                message: errors.e11.message,
            });
        }

        const AUTHENTICATION = await AuthenticationTokenModel(KNEX).generate(USER);

        res.status(200).json({
            user: AUTHENTICATION.user,
            token: AUTHENTICATION.token,
        });
    };

    logout = async (req: Request, res: Response): Promise<void> => {
        const AUTHENTICATION = await AuthenticationTokenModel(req.app.get("knex")).table()
            .where("id", req.credentials.jwt.tid)
            .delete();

        res.status(200).json({result: AUTHENTICATION === 1});
    };
}

const RegisterController = new Controller();
export default RegisterController;