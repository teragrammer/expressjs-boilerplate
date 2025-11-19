import {Request, Response} from "express";
import sgMail from "@sendgrid/mail";
import Joi from "joi";
import errors from "../../configurations/errors";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import {TwoFactorAuthenticationInterface} from "../../interfaces/two-factor-authentication.interface";
import {TFA_CONTINUE, TwoFactorAuthenticationModel} from "../../models/two-factor-authentication.model";
import {__ENV} from "../../configurations/environment";
import {logger} from "../../configurations/logger";
import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import AuthenticationTokenService from "../../services/authentication-token.service";
import SettingService from "../../services/setting.service";
import TwoFactorAuthenticationService from "../../services/two-factor-authentication.service";

class Controller {
    send = async (req: Request, res: Response): Promise<any> => {
        // check if tfa is required
        // to save resources
        if (req.credentials.jwt.tfa === TFA_CONTINUE) return res.status(403).json({
            code: errors.OTP_NOT_NEEDED.code,
            message: errors.OTP_NOT_NEEDED.message,
        });

        // check for valid email
        if (TwoFactorAuthenticationService.isEmailEmpty(req.credentials.jwt.eml)) return res.status(403).json({
            code: errors.UN_CONFIGURED_EMAIL.code,
            message: errors.UN_CONFIGURED_EMAIL.message,
        });

        // find for existing tfa
        const TFA: TwoFactorAuthenticationInterface = await TwoFactorAuthenticationModel().table()
            .where("token_id", req.credentials.jwt.tid)
            .first();

        try {
            const NEXT_TRY = DateUtil().expiredAt(2, "minutes");
            const CODE = SecurityUtil().randomNumber();

            // create or update the tfa
            let id;
            if (!TFA) {
                id = await TwoFactorAuthenticationModel().table().returning("id")
                    .insert({
                        token_id: req.credentials.jwt.tid,
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

                await TwoFactorAuthenticationModel().table().where("id", TFA.id).update({
                    code: await SecurityUtil().hash(CODE),
                    expired_at: DateUtil().expiredAt(5, "minutes"),
                    next_send_at: NEXT_TRY,
                    updated_at: DateUtil().sql(),
                });
            }

            // send the code to email
            if (__ENV.NODE_ENV === "production") {
                const SETTINGS: SettingKeyValueInterface = (await SettingService.getCache()).pri;

                try {
                    await sgMail.send({
                        to: req.credentials.jwt.eml || "",
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

        // check if tfa it required
        // to save resources
        if (CREDENTIALS.jwt.tfa === TFA_CONTINUE) return res.status(403).json({
            code: errors.OTP_NOT_NEEDED.code,
            message: errors.OTP_NOT_NEEDED.message,
        });

        // find for existing tfa
        const TFA: TwoFactorAuthenticationInterface = await TwoFactorAuthenticationModel().table()
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
            await TwoFactorAuthenticationModel().table()
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
            await TwoFactorAuthenticationModel().table()
                .where("id", TFA.id)
                .increment("tries");

            return res.status(400).json({
                code: errors.OTP_NO_MATCH.code,
                message: errors.OTP_NO_MATCH.message,
            });
        }

        // delete the tfa
        await TwoFactorAuthenticationModel().table().where("id", TFA.id).delete();

        // regenerate new token
        const TOKEN: string = await AuthenticationTokenService.token(await CREDENTIALS.user(), TFA_CONTINUE, {
            ip: req.ip || null,
            browser: req.useragent?.browser || null,
            os: req.useragent?.os || null,
        });

        res.status(200).json({token: TOKEN});
    };
}

const TwoFactorAuthenticationController = new Controller();
export default TwoFactorAuthenticationController;