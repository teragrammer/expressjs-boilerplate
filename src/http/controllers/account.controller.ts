import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {UserModel} from "../../models/user.model";
import {SecurityUtil} from "../../utilities/security.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {DateUtil} from "../../utilities/date.util";
import {UserInterface} from "../../interfaces/user.interface";
import AuthenticationTokenService from "../../services/authentication-token.service";

class Controller {
    information = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["first_name", "middle_name", "last_name", "address"]);
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            middle_name: Joi.string().min(1).max(100).allow(null, ""),
            last_name: Joi.string().min(1).max(100).required(),
            address: Joi.string().min(10).max(255).allow(null, ""),
        }), DATA, res)) return;

        try {
            const RESULT = await UserModel().table()
                .where("id", req.credentials.jwt.uid)
                .where("status", "Activated")
                .update(DATA);

            if (RESULT !== 1) return res.status(500).json({
                code: errors.UPDATE_FAILED.code,
                message: errors.UPDATE_FAILED.message,
            });

            // generate a token
            const TOKEN: string = await AuthenticationTokenService.generate(await req.credentials.user(), {
                ip: req.ip || null,
                browser: req.useragent?.browser || null,
                os: req.useragent?.os || null,
            });

            res.status(200).json({
                token: TOKEN,
            });
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    };

    password = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["current_password", "new_password", "username", "email", "phone"]);
        if (await ExtendJoiUtil().response(Joi.object({
            current_password: Joi.string().required(),
            new_password: Joi.string().min(8).max(32)
                .pattern(/[A-Z]/)           // At least one uppercase letter
                .pattern(/[a-z]/)           // At least one lowercase letter
                .pattern(/[0-9]/)           // At least one number
                .pattern(/[^A-Za-z0-9]/)    // At least one special character (e.g., !, @, #)
                .messages({
                    "string.min": "Password should be at least 8 characters long.",
                    "string.max": "Password should be no longer than 32 characters.",
                    "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
                    "any.required": "Password is required.",
                })
                .allow(null, ""),
            username: Joi.string().min(2).max(16).pattern(/^[a-zA-Z0-9_]+$/)
                .custom(ExtendJoiUtil().unique("users", "username", req.credentials.jwt.uid), errors.DUPLICATE_DATA.message)
                .allow(null, ""),
            email: Joi.string().email().max(180)
                .custom(ExtendJoiUtil().unique("users", "email", req.credentials.jwt.uid), errors.DUPLICATE_DATA.message)
                .allow(null, ""),
            phone: Joi.string().min(10).max(16)
                .custom(ExtendJoiUtil().phone, "Phone Number Validation")
                .custom(ExtendJoiUtil().unique("users", "phone", req.credentials.jwt.uid), errors.DUPLICATE_DATA.message)
                .allow(null, ""),
        }), DATA, res)) return;

        // verify the current password
        const ACCOUNT: UserInterface = await req.credentials.user();
        if (!ACCOUNT.password || !await SecurityUtil().compare(ACCOUNT.password, DATA.current_password)) {
            return res.status(403).json({
                code: errors.CREDENTIAL_DO_NOT_MATCH.code,
                message: errors.CREDENTIAL_DO_NOT_MATCH.message,
            });
        }

        // hashed if new password
        if (typeof DATA.new_password !== "undefined" && DATA.new_password !== null) DATA.password = await SecurityUtil().hash(DATA.new_password);

        try {
            // remove non-column keys
            if (typeof DATA.current_password !== "undefined") delete DATA.current_password;
            if (typeof DATA.new_password !== "undefined") delete DATA.new_password;

            DATA.updated_at = DateUtil().sql();
            const RESULT = await UserModel().table()
                .where("id", ACCOUNT.id)
                .where("status", "Activated")
                .update(DATA);

            if (RESULT !== 1) return res.status(500).json({
                code: errors.UPDATE_FAILED.code,
                message: errors.UPDATE_FAILED.message,
            });

            // generate a token
            if (typeof DATA.username !== "undefined") ACCOUNT.username = DATA.username;
            if (typeof DATA.email !== "undefined") ACCOUNT.email = DATA.email;
            if (typeof DATA.phone !== "undefined") ACCOUNT.phone = DATA.phone;
            const TOKEN: string = await AuthenticationTokenService.generate(ACCOUNT, {
                ip: req.ip || null,
                browser: req.useragent?.browser || null,
                os: req.useragent?.os || null,
            });

            res.status(200).json({
                token: TOKEN,
            });
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    };
}

const AccountController = new Controller();
export default AccountController;