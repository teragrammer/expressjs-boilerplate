import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {UserInterface} from "../../interfaces/user.interface";
import {UserModel} from "../../models/user.model";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import AuthenticationTokenService from "../../services/authentication-token.service";
import UserRepository from "../../repositories/user.repository";
import SettingService from "../../services/setting.service";

class Controller {
    login = async (req: Request, res: Response) => {
        const DATA = req.sanitize.body.only(["username", "password"]);
        if (await ExtendJoiUtil().response(Joi.object({
            username: Joi.string().required(),
            password: Joi.string().required(),
        }), DATA, res)) return;

        const USER: UserInterface = await UserRepository.byUsername(DATA.username);
        if (!USER) return res.status(404).json({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        // do not allow login if password is not set
        if (typeof USER.password === "undefined" || USER.password === null) res.status(400).json({
            code: errors.INCORRECT_PASS_SETUP.code,
            message: errors.INCORRECT_PASS_SETUP.message,
        });

        // check if failed login tries exceed
        const EXPIRED_AT = USER.failed_login_expired_at;
        if (EXPIRED_AT) {
            const LOGIN_EXPIRED_AT = DateUtil().unix(new Date(EXPIRED_AT));
            const CURRENT_TIME = DateUtil().unix();

            if (LOGIN_EXPIRED_AT >= CURRENT_TIME) {
                // too many login attempts
                return res.status(403).json({
                    code: errors.TOO_MANY_ATTEMPT.code,
                    message: errors.TOO_MANY_ATTEMPT.message,
                });
            } else {
                // reset failed login expiration
                await UserModel().table().update({failed_login_expired_at: null, login_tries: 0});
            }
        }

        if (USER.password && !await SecurityUtil().compare(USER.password, DATA.password)) {
            // increase the login attempt failed
            await UserModel().table().where("id", USER.id).increment("login_tries");

            // application settings
            const SETTINGS: SettingKeyValueInterface = (await SettingService.getCache()).pri;

            // update login tries
            const TOTAL_LOGIN_TRIES = (typeof Number(USER.login_tries) + 1 != undefined) ? Number(USER.login_tries) + 1 : 0;
            if (TOTAL_LOGIN_TRIES >= SETTINGS.mx_log_try) {
                // update the lock out period
                await UserModel().table().where("id", USER.id).update({
                    failed_login_expired_at: DateUtil().expiredAt(SETTINGS.lck_prd, "minutes"),
                });

                // too many login attempts
                return res.status(403).json({
                    code: errors.LOCKED_ACCOUNT.code,
                    message: errors.LOCKED_ACCOUNT.message,
                });
            }

            return res.status(403).json({
                code: errors.CREDENTIAL_DO_NOT_MATCH.code,
                message: errors.CREDENTIAL_DO_NOT_MATCH.message,
            });
        }

        // generate token
        const TOKEN: string = await AuthenticationTokenService.generate(USER, {
            ip: req.ip || null,
            browser: req.useragent?.browser || null,
            os: req.useragent?.os || null,
        });

        res.status(200).json({
            token: TOKEN,
        });
    };

    logout = async (req: Request, res: Response): Promise<any> => {
        const RESULT: number = await AuthenticationTokenModel().table()
            .where("id", req.credentials.jwt.tid)
            .delete();

        if (RESULT !== 1) return res.status(500).json({
            code: errors.DELETE_FAILED.code,
            message: errors.DELETE_FAILED.message,
        });

        res.status(200).send();
    };
}

const RegisterController = new Controller();
export default RegisterController;