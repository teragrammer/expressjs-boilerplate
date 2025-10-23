import {Request, Response} from "express";
import sgMail from "@sendgrid/mail";
import Joi from "joi";
import errors from "../../configurations/errors";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import {TwoFactorAuthenticationInterface} from "../../interfaces/two-factor-authentication.interface";
import {TwoFactorAuthenticationModel} from "../../models/two-factor-authentication.model";
import {__ENV} from "../../configurations/environment";
import {logger} from "../../configurations/logger";
import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {Knex} from "knex";
import {CACHE_SETT_NAME} from "../../models/setting.model";

class Controller {
    send = async (req: Request, res: Response): Promise<any> => {
        const CREDENTIALS = req.credentials;
        const NEXT_TRY = DateUtil().expiredAt(2, "minutes");
        const CODE = SecurityUtil().randomNumber();

        const KNEX: Knex = req.app.get("knex");

        // check if tfa is required
        // to save resources
        if (CREDENTIALS.jwt.tfa === "con") return res.status(403).json({
            code: errors.OTP_NOT_NEEDED.code,
            message: errors.OTP_NOT_NEEDED.message,
        });

        // check for valid email
        if (IS_EMAIL_EMPTY(CREDENTIALS.jwt.eml)) return res.status(403).json({
            code: errors.UN_CONFIGURED_EMAIL.code,
            message: errors.UN_CONFIGURED_EMAIL.message,
        });

        // find for existing tfa
        const TFA: TwoFactorAuthenticationInterface = await TwoFactorAuthenticationModel(KNEX).table()
            .where("token_id", CREDENTIALS.jwt.tid)
            .first();

        try {
            // create or update the tfa
            let id;
            if (!TFA) {
                id = await TwoFactorAuthenticationModel(KNEX).table().returning("id")
                    .insert({
                        token_id: CREDENTIALS.jwt.tid,
                        code: await SecurityUtil().hash(CODE),
                        expired_at: DateUtil().expiredAt(5, "minutes"),
                        next_send_at: NEXT_TRY,
                        created_at: DateUtil().sql(),
                    });
                id = id[0];
            } else if (TFA.next_send_at !== null) {
                id = TFA.id;

                const CURRENT_TIME = DateUtil().unix();
                const NEXT_SEND_AT = DateUtil().unix(new Date(TFA.next_send_at));

                if (CURRENT_TIME < NEXT_SEND_AT) return res.status(403).json({
                    code: errors.RESEND_OTP_NOT_POSSIBLE.code,
                    message: errors.RESEND_OTP_NOT_POSSIBLE.message,
                });

                await TwoFactorAuthenticationModel(KNEX).table().where("id", TFA.id).update({
                    code: await SecurityUtil().hash(CODE),
                    expired_at: DateUtil().expiredAt(5, "minutes"),
                    next_send_at: NEXT_TRY,
                    updated_at: DateUtil().sql(),
                });
            }

            // send the code to email
            if (__ENV.NODE_ENV === "production") {
                const SETTINGS: SettingKeyValueInterface = req.app.get(CACHE_SETT_NAME)().pri;

                try {
                    await sgMail.send({
                        to: CREDENTIALS.jwt.eml,
                        from: SETTINGS.tta_eml_snd,
                        subject: SETTINGS.tta_eml_sbj,
                        text: `OTP Code: ${CODE}`,
                    });
                } catch (e) {
                    logger.error(e);

                    return res.status(500).json({
                        code: errors.UNABLE_TO_SEND_EMAIL.code,
                        message: errors.UNABLE_TO_SEND_EMAIL.message,
                    });
                }
            }

            res.status(200).json({id, next_try: NEXT_TRY});
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    };

    validate = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["code"]);
        if (await ExtendJoiUtil().response(Joi.object({
            code: Joi.number().integer().required(),
        }), DATA, res)) return;

        const CREDENTIALS = req.credentials;
        const KNEX: Knex = req.app.get("knex");

        // check if tfa it required
        // to save resources
        if (CREDENTIALS.jwt.tfa === "con") return res.status(403).json({
            code: errors.OTP_NOT_NEEDED.code,
            message: errors.OTP_NOT_NEEDED.message,
        });

        // find for existing tfa
        const TFA: TwoFactorAuthenticationInterface = await TwoFactorAuthenticationModel(KNEX).table()
            .where("token_id", CREDENTIALS.jwt.tid)
            .first();
        if (!TFA) return res.status(404).json({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        // check for expiration
        if (!TFA.expired_at) return res.status(404).json({
            code: errors.UN_CONFIGURED_EXPIRATION.code,
            message: errors.UN_CONFIGURED_EXPIRATION.message,
        });

        const CURRENT_TIME = DateUtil().unix();

        // if code is expired
        const EXPIRED_AT = DateUtil().unix(new Date(TFA.expired_at));
        if (CURRENT_TIME > EXPIRED_AT) return res.status(419).json({
            code: errors.RESOURCE_EXPIRED.code,
            message: errors.RESOURCE_EXPIRED.message,
        });

        // multiple pending tries
        if (TFA.expired_tries_at) {
            const EXPIRED_TRIES_AT = DateUtil().unix(new Date(TFA.expired_tries_at));

            if (EXPIRED_TRIES_AT > CURRENT_TIME) return res.status(403).json({
                code: errors.TOO_MANY_ATTEMPT.code,
                message: errors.TOO_MANY_ATTEMPT.message,
            });

            // reset the tries
            await TwoFactorAuthenticationModel(KNEX).table()
                .where("id", TFA.id)
                .update({
                    tries: 0,
                    expired_tries_at: null,
                });
        }

        // too many failed tries
        if (TFA.tries > 5) return res.status(403).json({
            code: errors.TOO_MANY_ATTEMPT.code,
            message: errors.TOO_MANY_ATTEMPT.message,
        });

        // verify if code is valid
        if (!await SecurityUtil().compare(TFA.code, DATA.code)) {
            // record number of tries
            await TwoFactorAuthenticationModel(KNEX).table()
                .where("id", TFA.id)
                .increment("tries");

            return res.status(400).json({
                code: errors.OTP_NO_MATCH.code,
                message: errors.OTP_NO_MATCH.message,
            });
        }

        // delete the tfa
        await TwoFactorAuthenticationModel(KNEX).table().where("id", TFA.id).delete();

        // regenerate new token
        let token: string = await AuthenticationTokenModel(KNEX).token(await CREDENTIALS.user(), "con");

        res.status(200).json({token});
    };
}

const IS_EMAIL_EMPTY = (email: string | null | undefined) => email === undefined || email === null || email === "";

const TwoFactorAuthenticationController = new Controller();
export default TwoFactorAuthenticationController;