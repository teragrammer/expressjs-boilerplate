import {Request, Response} from "express";
import Joi from "joi";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {UserModel} from "../../models/user.model";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {SecurityUtil} from "../../utilities/security.util";
import {DateUtil} from "../../utilities/date.util";
import {UserInterface} from "../../interfaces/user.interface";
import {RoleInterface} from "../../interfaces/role.interface";
import AuthenticationTokenService from "../../services/authentication-token.service";
import {RoleModel} from "../../models/role.model";
import UserRepository from "../../repositories/user.repository";
import catchAsync from "../../utilities/catch-async";

class Controller {
    create = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["first_name", "middle_name", "last_name", "username", "password", "email"]);
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(2).max(100).required(),
            middle_name: Joi.string().min(2).max(100).allow(null, ""),
            last_name: Joi.string().min(1).max(100).required(),
            username: Joi.string().min(3).max(16).pattern(/^[a-zA-Z0-9_]+$/).required().custom(ExtendJoiUtil().unique("users", "username"), errors.DUPLICATE_DATA.message),
            email: Joi.string().email().max(180).required().custom(ExtendJoiUtil().unique("users", "email"), errors.DUPLICATE_DATA.message),
            password: Joi.string().min(8).max(32)
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
                .required(),
        }), DATA, res)) return;

        // check if role is valid
        const ROLE: RoleInterface = await RoleModel().table().where("slug", "customer").first();
        if (!ROLE) return res.status(404).json({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        try {
            // create the new user
            DATA.role_id = ROLE.id;
            DATA.password = await SecurityUtil().hash(DATA.password);
            DATA.created_at = DateUtil().sql();
            const [ID] = await UserModel().table().returning("id").insert(DATA);

            // get the full details
            const CUSTOMER: UserInterface = await UserRepository.byId(ID);
            if (!CUSTOMER) return res.status(404).json({
                code: errors.DATA_NOT_FOUND.code,
                message: errors.DATA_NOT_FOUND.message,
            });

            // generate a token
            const TOKEN: string = await AuthenticationTokenService.generate(CUSTOMER, {
                ip: req.ip || null,
                browser: req.useragent?.browser || null,
                os: req.useragent?.os || null,
            });

            res.status(200).json({
                token: TOKEN,
            });
        } catch (e: any) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    });
}

const RegisterController = new Controller();
export default RegisterController;