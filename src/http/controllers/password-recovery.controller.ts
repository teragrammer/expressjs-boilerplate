import {Express, Request, Response} from "express";
import Joi from "joi";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {PasswordRecoveryModel, TYPES} from "../../models/password-recovery.model";
import {UserModel} from "../../models/user.model";
import {UserInterface} from "../../interfaces/user.interface";
import errors from "../../configurations/errors";
import {PasswordRecoveryInterface} from "../../interfaces/password-recovery.interface";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";

const CODE_LENGTH = 6;

const NEXT_RESEND_MINUTES = 2;
const CODE_EXPIRATION_MINUTES = 30;

const MAX_TRIES = 5;
const NEXT_TRY_MINUTES = 3;

export default (app: Express) => {
    return {
        async send(req: Request, res: Response): Promise<any> {
            const data = req.body;
            if (await ExtendJoiUtil().response(Joi.object({
                to: Joi.string().required().valid(...TYPES),
            }), {to: data.to}, res)) return;

            // validate where to send the code
            const validatedSendToType = await validateSendToType(data, res)
            if (!validatedSendToType.status || !validatedSendToType.name || !validatedSendToType.value) return

            const user: UserInterface = await UserModel(app.knex).table().where(validatedSendToType.name, validatedSendToType.value).first();
            if (!user) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
                errors: [{
                    field: 'email',
                    message: `Unable to find ${validatedSendToType.name}`
                }]
            })

            const recovery: PasswordRecoveryInterface = await PasswordRecoveryModel(app.knex).table().where('send_to', validatedSendToType.value).first();
            if (recovery && recovery.next_resend_at && DateUtil().unix(new Date(recovery.next_resend_at)) > DateUtil().unix()) {
                return res.status(400).json({
                    code: errors.e25.code,
                    message: errors.e25.message,
                })
            }

            const code = SecurityUtil().randomString(CODE_LENGTH)

            // TODO
            // send code to email or phone

            await PasswordRecoveryModel(app.knex).table().where('send_to', validatedSendToType.value).delete();
            await PasswordRecoveryModel(app.knex).table().insert({
                type: data.type,
                send_to: validatedSendToType.value,
                code: await SecurityUtil().hash(code),
                next_resend_at: DateUtil().expiredAt(NEXT_RESEND_MINUTES, 'minutes'),
                expired_at: DateUtil().expiredAt(CODE_EXPIRATION_MINUTES, 'minutes'),
            })

            return res.status(200).json({
                status: true,
            });
        },

        async validate(req: Request, res: Response): Promise<any> {
            const data = req.body;
            if (await ExtendJoiUtil().response(Joi.object({
                to: Joi.string().required().valid(...TYPES),
                code: Joi.string().min(6).max(6).required(),
            }), {
                to: data.to,
                code: data.code,
            }, res)) return;

            // validate where to send the code
            const validatedSendToType = await validateSendToType(data, res)
            if (!validatedSendToType.status || !validatedSendToType.name || !validatedSendToType.value) return

            const recovery: PasswordRecoveryInterface = await PasswordRecoveryModel(app.knex).table().where('send_to', validatedSendToType.value).first();
            if (!recovery) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
                errors: [{
                    field: 'email',
                    message: `Unable to find ${validatedSendToType.name}`
                }]
            })

            if (recovery.tries >= MAX_TRIES) {
                let isExceedTries = true;
                if (recovery.next_try_at) {
                    const nextTryAt = DateUtil().unix(new Date(recovery.next_try_at));
                    const currentTime = DateUtil().unix();

                    if (nextTryAt <= currentTime) isExceedTries = false;
                } else {
                    await PasswordRecoveryModel(app.knex).table()
                        .where('id', recovery.id)
                        .update({
                            next_try_at: DateUtil().expiredAt(NEXT_TRY_MINUTES, 'minutes'),
                        })
                }

                if (isExceedTries) {
                    return res.status(404).json({
                        code: errors.e26.code,
                        message: errors.e26.message,
                    })
                }
            }

            if (!await SecurityUtil().compare(recovery.code, data.code)) {
                await PasswordRecoveryModel(app.knex).table().increment('tries');

                return res.status(400).json({
                    code: errors.e27.code,
                    message: errors.e27.message,
                })
            }

            // remove all recovery
            await PasswordRecoveryModel(app.knex).table().where('send_to', validatedSendToType.value).delete()

            // set user authentication token
            const user: UserInterface = await UserModel(app.knex).table().where(validatedSendToType.name, recovery.send_to).first();
            if (!user) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
            })
            const authentication = await AuthenticationTokenModel(app.knex).generate(user);

            // change the user password to current recovery token
            await UserModel(app.knex).table().where(validatedSendToType.name, recovery.send_to).update({
                password: await SecurityUtil().hash(data.token),
                updated_at: DateUtil().sql()
            })

            res.status(200).json({
                user: authentication.user,
                credential: authentication.token,
            })
        },
    }
}

const validateSendToType = async (data: any, res: Response) => {
    // validate where to send the code
    if (data.to === 'email') {
        if (await ExtendJoiUtil().response(Joi.object({
            email: Joi.string().min(1).max(100).email().required(),
        }), {email: data.email}, res)) return {status: false};
    }
    if (data.to === 'phone') {
        if (await ExtendJoiUtil().response(Joi.object({
            phone: Joi.string().min(1).max(100).required().custom(ExtendJoiUtil().phone, 'Phone Number Validation'),
        }), {phone: data.phone}, res)) return {status: false}
    }

    let columnName = data.to === 'email' ? 'email' : 'phone'
    let columnValue = data.to === 'email' ? data.email : data.phone

    return {
        status: true,
        name: columnName,
        value: columnValue,
    }
}