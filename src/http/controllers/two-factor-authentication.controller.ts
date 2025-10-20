import {Express, Request, Response} from "express";
import sgMail from "@sendgrid/mail";
import Joi from "joi";
import errors from "../../configurations/errors";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import {TwoFactorAuthenticationInterface} from "../../interfaces/two-factor-authentication.interface";
import {TwoFactorAuthenticationModel} from "../../models/two-factor-authentication.model";
import {__ENV} from "../../configurations/env";
import {logger} from "../../configurations/logger";
import {SettingKeyValueInterface} from "../../interfaces/setting-key-value.interface";
import {SettingModel} from "../../models/setting.model";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";

export default (app: Express) => {
    const isEmailEmpty = (email: string | null | undefined) => email === undefined || email === null || email === '';

    return {
        async send(req: Request, res: Response): Promise<any> {
            const credentials = req.credentials;
            const nextTry = DateUtil().expiredAt(2, 'minutes');
            const code = SecurityUtil().randomNumber()

            // check if tfa is required
            // to save resources
            if (credentials.jwt.tfa === 'con') return res.status(403).json({
                code: errors.e20.code,
                message: errors.e20.message,
            });

            // check for valid email
            if (isEmailEmpty(credentials.jwt.eml)) return res.status(403).json({
                code: errors.e18.code,
                message: errors.e18.message,
            });

            // find for existing tfa
            const tfa: TwoFactorAuthenticationInterface = await TwoFactorAuthenticationModel(app.knex).table()
                .where('token_id', credentials.jwt.tid)
                .first();

            try {
                // create or update the tfa
                let id;
                if (!tfa) {
                    id = await TwoFactorAuthenticationModel(app.knex).table().returning('id')
                        .insert({
                            token_id: credentials.jwt.tid,
                            code: await SecurityUtil().hash(code),
                            expired_at: DateUtil().expiredAt(5, 'minutes'),
                            next_send_at: nextTry,
                            created_at: DateUtil().sql()
                        })
                    id = id[0]
                } else if (tfa.next_send_at !== null) {
                    id = tfa.id;

                    const currentTime = DateUtil().unix();
                    const nextSendAt = DateUtil().unix(new Date(tfa.next_send_at));

                    if (currentTime < nextSendAt) return res.status(403).json({
                        code: errors.e17.code,
                        message: errors.e17.message,
                    });

                    await TwoFactorAuthenticationModel(app.knex).table().where('id', tfa.id).update({
                        code: await SecurityUtil().hash(code),
                        expired_at: DateUtil().expiredAt(5, 'minutes'),
                        next_send_at: nextTry,
                        updated_at: DateUtil().sql()
                    })
                }

                // send the code to email
                if (__ENV.NODE_ENV === 'production') {
                    const settings: SettingKeyValueInterface = await SettingModel(app.knex).value(['tta_eml_snd', 'tta_eml_sbj'])

                    try {
                        await sgMail.send({
                            to: credentials.jwt.eml,
                            from: settings.tta_eml_snd,
                            subject: settings.tta_eml_sbj,
                            text: `OTP Code: ${code}`,
                        });
                    } catch (e) {
                        logger.error(e);

                        return res.status(500).json({
                            code: errors.e19.code,
                            message: errors.e19.message,
                        })
                    }
                }

                res.status(200).json({id, next_try: nextTry})
            } catch (e) {
                logger.error(e);

                res.status(500).json({
                    code: errors.e4.code,
                    message: errors.e4.message,
                });
            }
        },

        async validate(req: Request, res: Response): Promise<any> {
            const data = req.body;
            if (await ExtendJoiUtil().response(Joi.object({
                code: Joi.number().integer().required(),
            }), data, res)) return;

            const credentials = req.credentials;

            // check if tfa it required
            // to save resources
            if (credentials.jwt.tfa === 'con') return res.status(403).json({
                code: errors.e20.code,
                message: errors.e20.message,
            });

            // find for existing tfa
            const tfa: TwoFactorAuthenticationInterface = await TwoFactorAuthenticationModel(app.knex).table()
                .where('token_id', credentials.jwt.tid)
                .first();
            if (!tfa) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
            });

            // check for expiration
            if (!tfa.expired_at) return res.status(404).json({
                code: errors.e21.code,
                message: errors.e21.message,
            });

            const currentTime = DateUtil().unix();

            // if code is expired
            const expiredAt = DateUtil().unix(new Date(tfa.expired_at));
            if (currentTime > expiredAt) return res.status(419).json({
                code: errors.e22.code,
                message: errors.e22.message,
            });

            // multiple pending tries
            if (tfa.expired_tries_at) {
                const expiredTriesAt = DateUtil().unix(new Date(tfa.expired_tries_at));

                if (expiredTriesAt > currentTime) return res.status(403).json({
                    code: errors.e24.code,
                    message: errors.e24.message,
                });

                // reset the tries
                await TwoFactorAuthenticationModel(app.knex).table()
                    .where('id', tfa.id)
                    .update({
                        tries: 0,
                        expired_tries_at: null,
                    });
            }

            // too many failed tries
            if (tfa.tries > 5) return res.status(403).json({
                code: errors.e24.code,
                message: errors.e24.message,
            });

            // verify if code is valid
            if (!await SecurityUtil().compare(tfa.code, data.code)) {
                // record number of tries
                await TwoFactorAuthenticationModel(app.knex).table()
                    .where('id', tfa.id)
                    .increment('tries');

                return res.status(400).json({
                    code: errors.e23.code,
                    message: errors.e23.message,
                });
            }

            // delete the tfa
            await TwoFactorAuthenticationModel(app.knex).table().where('id', tfa.id).delete();

            // regenerate new token
            const token: string = await AuthenticationTokenModel(app.knex).token(await credentials.user(), 'con');

            res.status(200).json({token: token});
        }
    }
}