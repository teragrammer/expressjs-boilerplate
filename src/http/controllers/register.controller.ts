import {Request, Response} from "express";
import Joi from "joi";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {UserModel} from "../../models/user.model";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {SecurityUtil} from "../../utilities/security.util";
import {DateUtil} from "../../utilities/date.util";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {UserInterface} from "../../interfaces/user.interface";
import {RoleInterface} from "../../interfaces/role.interface";
import {Knex} from "knex";

class Controller {
    create = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");

        const DATA = req.sanitize.body.only(["first_name", "middle_name", "last_name", "username", "password", "email"]);
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(2).max(100).required(),
            middle_name: Joi.string().min(2).max(100),
            last_name: Joi.string().min(1).max(100).required(),
            username: Joi.string().min(3).max(16).required().custom(ExtendJoiUtil().unique(KNEX, "users", "username"), errors.DUPLICATE_DATA.message),
            email: Joi.string().email().max(180).required().custom(ExtendJoiUtil().unique(KNEX, "users", "email"), errors.DUPLICATE_DATA.message),
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
        const ROLE: RoleInterface = await KNEX.table("roles").where("slug", "customer").first();
        if (!ROLE) return res.status(404).json({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        try {
            // create the new user
            DATA.role_id = ROLE.id;
            DATA.password = await SecurityUtil().hash(DATA.password);
            DATA.created_at = DateUtil().sql();
            const RESULT: any = await UserModel(KNEX).table().returning("id").insert(DATA);
            if (!RESULT.length) return res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });

            // get the full details
            const CUSTOMER: UserInterface = await UserModel(KNEX).profile(RESULT[0]);
            if (!CUSTOMER) return res.status(404).json({
                code: errors.DATA_NOT_FOUND.code,
                message: errors.DATA_NOT_FOUND.message,
            });

            // generate a token
            const AUTHENTICATION = await AuthenticationTokenModel(KNEX).generate(CUSTOMER);

            res.status(200).json({
                credential: AUTHENTICATION.token,
            });
        } catch (e: any) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    };
}

const RegisterController = new Controller();
export default RegisterController;