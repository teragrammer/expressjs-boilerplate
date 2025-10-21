import {Application, Express, Request, Response} from "express";
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
import {Knex} from "knex";

const CODE_LENGTH = 6;

const NEXT_RESEND_MINUTES = 2;
const CODE_EXPIRATION_MINUTES = 30;

const MAX_TRIES = 5;
const NEXT_TRY_MINUTES = 3;

class Controller {
    send = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            to: Joi.string().required().valid(...TYPES),
        }), {to: DATA.to}, res)) return;

        const KNEX: Knex = res.app.get('knex');

        // validate where to send the code
        const VALIDATED_SEND_TO_TYPE = await VALIDATE_SEND_TO_TYPE(DATA, res);
        if (!VALIDATED_SEND_TO_TYPE.status || !VALIDATED_SEND_TO_TYPE.name || !VALIDATED_SEND_TO_TYPE.value) return;

        const USER: UserInterface = await UserModel(KNEX).table().where(VALIDATED_SEND_TO_TYPE.name, VALIDATED_SEND_TO_TYPE.value).first();
        if (!USER) return res.status(404).json({
            code: errors.e3.code,
            message: errors.e3.message,
            errors: [{
                field: VALIDATED_SEND_TO_TYPE.name,
                message: `Unable to find ${VALIDATED_SEND_TO_TYPE.name}`,
            }],
        });

        const RECOVERY: PasswordRecoveryInterface = await PasswordRecoveryModel(KNEX).table().where("send_to", VALIDATED_SEND_TO_TYPE.value).first();
        if (RECOVERY && RECOVERY.next_resend_at && DateUtil().unix(new Date(RECOVERY.next_resend_at)) > DateUtil().unix()) {
            return res.status(400).json({
                code: errors.e25.code,
                message: errors.e25.message,
            });
        }

        const CODE = SecurityUtil().randomString(CODE_LENGTH);

        // TODO
        // send code to email or phone

        await PasswordRecoveryModel(KNEX).table().where("send_to", VALIDATED_SEND_TO_TYPE.value).delete();
        await PasswordRecoveryModel(KNEX).table().insert({
            type: DATA.type,
            send_to: VALIDATED_SEND_TO_TYPE.value,
            code: await SecurityUtil().hash(CODE),
            next_resend_at: DateUtil().expiredAt(NEXT_RESEND_MINUTES, "minutes"),
            expired_at: DateUtil().expiredAt(CODE_EXPIRATION_MINUTES, "minutes"),
        });

        return res.status(200).json({
            status: true,
        });
    };

    validate = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            to: Joi.string().required().valid(...TYPES),
            code: Joi.string().min(6).max(6).required(),
        }), {
            to: DATA.to,
            code: DATA.code,
        }, res)) return;

        // validate where to send the code
        const VALIDATED_SEND_TO_TYPE = await VALIDATE_SEND_TO_TYPE(DATA, res);
        if (!VALIDATED_SEND_TO_TYPE.status || !VALIDATED_SEND_TO_TYPE.name || !VALIDATED_SEND_TO_TYPE.value) return;

        const KNEX: Knex = res.app.get('knex');

        const RECOVERY: PasswordRecoveryInterface = await PasswordRecoveryModel(KNEX).table().where("send_to", VALIDATED_SEND_TO_TYPE.value).first();
        if (!RECOVERY) return res.status(404).json({
            code: errors.e3.code,
            message: errors.e3.message,
            errors: [{
                field: VALIDATED_SEND_TO_TYPE.name,
                message: `Unable to find ${VALIDATED_SEND_TO_TYPE.name}`,
            }],
        });

        if (RECOVERY.tries >= MAX_TRIES) {
            let isExceedTries = true;

            if (RECOVERY.next_try_at) {
                const NEXT_TRY_AT = DateUtil().unix(new Date(RECOVERY.next_try_at));
                const CURRENT_TIME = DateUtil().unix();

                if (NEXT_TRY_AT <= CURRENT_TIME) isExceedTries = false;
            } else {
                await PasswordRecoveryModel(KNEX).table()
                    .where("id", RECOVERY.id)
                    .update({
                        next_try_at: DateUtil().expiredAt(NEXT_TRY_MINUTES, "minutes"),
                    });
            }

            if (isExceedTries) {
                return res.status(422).json({
                    code: errors.e26.code,
                    message: errors.e26.message,
                });
            }
        }

        if (!await SecurityUtil().compare(RECOVERY.code, DATA.code)) {
            await PasswordRecoveryModel(KNEX).table().increment("tries");

            return res.status(400).json({
                code: errors.e27.code,
                message: errors.e27.message,
            });
        }

        // remove all recovery
        await PasswordRecoveryModel(KNEX).table().where("send_to", VALIDATED_SEND_TO_TYPE.value).delete();

        // set user authentication token
        const USER: UserInterface = await UserModel(KNEX).table().where(VALIDATED_SEND_TO_TYPE.name, RECOVERY.send_to).first();
        if (!USER) return res.status(404).json({
            code: errors.e3.code,
            message: errors.e3.message,
        });
        const AUTHENTICATION = await AuthenticationTokenModel(KNEX).generate(USER);

        // change the user password to current recovery code
        await UserModel(KNEX).table().where(VALIDATED_SEND_TO_TYPE.name, RECOVERY.send_to).update({
            password: await SecurityUtil().hash(DATA.code),
            updated_at: DateUtil().sql(),
        });

        res.status(200).json({
            user: AUTHENTICATION.user,
            credential: AUTHENTICATION.token,
        });
    }
}

const VALIDATE_SEND_TO_TYPE = async (data: any, res: Response) => {
    // validate where to send the code
    if (data.to === "email") {
        if (await ExtendJoiUtil().response(Joi.object({
            email: Joi.string().min(1).max(100).email().required(),
        }), {email: data.email}, res)) return {status: false};
    }
    if (data.to === "phone") {
        if (await ExtendJoiUtil().response(Joi.object({
            phone: Joi.string().min(1).max(100).required().custom(ExtendJoiUtil().phone, "Phone Number Validation"),
        }), {phone: data.phone}, res)) return {status: false};
    }

    let columnName = data.to === "email" ? "email" : "phone";
    let columnValue = data.to === "email" ? data.email : data.phone;

    return {
        status: true,
        name: columnName,
        value: columnValue,
    };
};

const PasswordRecoveryController = new Controller();
export default PasswordRecoveryController;