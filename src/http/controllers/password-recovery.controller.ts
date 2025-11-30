import {Request, Response} from "express";
import Joi from "joi";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {PasswordRecoveryModel, RECOVERY_EMAIL, RECOVERY_PHONE, TYPES} from "../../models/password-recovery.model";
import {UserModel} from "../../models/user.model";
import {UserInterface} from "../../interfaces/user.interface";
import errors from "../../configurations/errors";
import {PasswordRecoveryInterface} from "../../interfaces/password-recovery.interface";
import {DateUtil} from "../../utilities/date.util";
import {SecurityUtil} from "../../utilities/security.util";
import AuthenticationTokenService from "../../services/authentication-token.service";
import PasswordRecoveryService from "../../services/password-recovery.service";
import UserRepository from "../../repositories/user.repository";
import catchAsync from "../../utilities/catch-async";

const CODE_LENGTH = 6;

const NEXT_RESEND_MINUTES = 2;
const CODE_EXPIRATION_MINUTES = 30;

const MAX_TRIES = 5;
const NEXT_TRY_MINUTES = 3;

class Controller {
    send = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["to", RECOVERY_EMAIL, RECOVERY_PHONE]);
        if (await ExtendJoiUtil().response(Joi.object({
            to: Joi.string().required().valid(...TYPES),
        }), {to: DATA.to}, res)) return;

        // validate where to send the code
        const SEND_TO = await PasswordRecoveryService.validateSender(DATA);
        if (!SEND_TO.status || !SEND_TO.name || !SEND_TO.value) return;

        const USER: UserInterface = await UserModel().table().where(SEND_TO.name, SEND_TO.value).first();
        if (!USER) return res.status(404).json({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
            errors: [{
                field: SEND_TO.name,
                message: `Unable to find ${SEND_TO.name}`,
            }],
        });

        const RECOVERY: PasswordRecoveryInterface = await PasswordRecoveryModel().table().where("send_to", SEND_TO.value).first();
        if (RECOVERY && RECOVERY.next_resend_at && DateUtil().unix(new Date(RECOVERY.next_resend_at)) > DateUtil().unix()) {
            return res.status(400).json({
                code: errors.TRY_RESEND.code,
                message: errors.TRY_RESEND.message,
            });
        }

        const CODE = SecurityUtil().randomString(CODE_LENGTH);

        // send code to email or phone
        await PasswordRecoveryService.send(SEND_TO.name, SEND_TO.value, CODE);

        await PasswordRecoveryModel().table().where("send_to", SEND_TO.value).delete();
        await PasswordRecoveryModel().table().insert({
            type: DATA.type,
            send_to: SEND_TO.value,
            code: await SecurityUtil().hash(CODE),
            next_resend_at: DateUtil().expiredAt(NEXT_RESEND_MINUTES, "minutes"),
            expired_at: DateUtil().expiredAt(CODE_EXPIRATION_MINUTES, "minutes"),
        });

        return res.status(200).send();
    });

    validate = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["to", "code", RECOVERY_EMAIL, RECOVERY_PHONE]);
        if (await ExtendJoiUtil().response(Joi.object({
            to: Joi.string().required().valid(...TYPES),
            code: Joi.string().min(6).max(6).required(),
        }), {to: DATA.to, code: DATA.code}, res)) return;

        // validate where to send the code
        const SEND_TO = await PasswordRecoveryService.validateSender(DATA);
        if (!SEND_TO.status || !SEND_TO.name || !SEND_TO.value) return;

        const RECOVERY: PasswordRecoveryInterface = await PasswordRecoveryModel().table().where("send_to", SEND_TO.value).first();
        if (!RECOVERY) return res.status(404).json({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
            errors: [{
                field: SEND_TO.name,
                message: `Unable to find ${SEND_TO.name}`,
            }],
        });

        if (RECOVERY.tries >= MAX_TRIES) {
            let isExceedTries = true;

            if (RECOVERY.next_try_at) {
                const NEXT_TRY_AT = DateUtil().unix(new Date(RECOVERY.next_try_at));
                const CURRENT_TIME = DateUtil().unix();

                if (NEXT_TRY_AT <= CURRENT_TIME) isExceedTries = false;
            } else {
                await PasswordRecoveryModel().table()
                    .where("id", RECOVERY.id)
                    .update({
                        next_try_at: DateUtil().expiredAt(NEXT_TRY_MINUTES, "minutes"),
                    });
            }

            if (isExceedTries) {
                return res.status(422).json({
                    code: errors.EXCEED_RECOVERY.code,
                    message: errors.EXCEED_RECOVERY.message,
                });
            }
        }

        if (!await SecurityUtil().compare(RECOVERY.code, DATA.code)) {
            await PasswordRecoveryModel().table().where("send_to", RECOVERY.send_to).increment("tries");

            return res.status(400).json({
                code: errors.RECOVERY_CODE_INVALID.code,
                message: errors.RECOVERY_CODE_INVALID.message,
            });
        }

        // remove all recovery
        await PasswordRecoveryModel().table().where("send_to", SEND_TO.value).delete();

        // set user authentication token
        const USER: UserInterface | null = await UserRepository.byContact(SEND_TO.name, RECOVERY.send_to);
        if (!USER) return res.status(404).json({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });
        const TOKEN: string = await AuthenticationTokenService.generate(USER, {
            ip: req.ip || null,
            browser: req.useragent?.browser || null,
            os: req.useragent?.os || null,
        });

        // change the user password to current recovery code
        await UserModel().table().where(SEND_TO.name, RECOVERY.send_to).update({
            password: await SecurityUtil().hash(DATA.code),
            updated_at: DateUtil().sql(),
        });

        res.status(200).json({
            token: TOKEN,
        });
    });
}

const PasswordRecoveryController = new Controller();
export default PasswordRecoveryController;