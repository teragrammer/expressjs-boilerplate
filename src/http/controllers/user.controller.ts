import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {STATUSES, UserModel} from "../../models/user.model";
import {logger} from "../../configurations/logger";
import {SecurityUtil} from "../../utilities/security.util";
import {UserInterface} from "../../interfaces/user.interface";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = UserModel().table();

        const ROLE_ID: any = req.sanitize.query.numeric("role_id");
        if (ROLE_ID !== null) Q.where("role_id", ROLE_ID);

        const STATUS: any = req.sanitize.query.get("status");
        if (STATUS !== null) Q.where("status", STATUS);

        const KEYWORD: any = req.sanitize.query.get("search");
        if (KEYWORD !== null) {
            Q.where((queryBuilder: any) => {
                queryBuilder.where("first_name", "LIKE", `%${KEYWORD}%`)
                    .orWhere("middle_name", "LIKE", `%${KEYWORD}%`)
                    .orWhere("last_name", "LIKE", `%${KEYWORD}%`)
                    .orWhere("username", "LIKE", `%${KEYWORD}%`)
                    .orWhere("phone", "LIKE", `%${KEYWORD}%`)
                    .orWhere("email", "LIKE", `%${KEYWORD}%`);
            });
        }

        const PAGINATE = res.app.get("paginate");
        const USERS: UserInterface[] = await Q.offset(PAGINATE.offset).limit(PAGINATE.perPage);

        // remove sensitive data
        for (let i = 0; i < USERS.length; i++) UserModel().hidden(USERS[i]);

        res.status(200).json(USERS);
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const USER: UserInterface = await UserModel().table()
            .where("id", ID)
            .first();

        if (!USER) return res.status(404).send({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        // remove sensitive data
        delete USER.password;

        return res.status(200).json(USER);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only([
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ]);
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            middle_name: Joi.string().min(1).max(100).allow(null, ""),
            last_name: Joi.string().min(1).max(100).required(),

            role_id: Joi.number().integer().required().external(ExtendJoiUtil().exists("users")),
            phone: Joi.string().min(10).max(16).allow(null, "").external(ExtendJoiUtil().phone).external(ExtendJoiUtil().unique("users", "phone")),
            email: Joi.string().email().max(180).allow(null, "").external(ExtendJoiUtil().unique("users", "email")),
            username: Joi.string().min(2).max(16).pattern(/^[a-zA-Z0-9_]+$/).allow(null, "").external(ExtendJoiUtil().unique("users", "username")),
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
                .allow(null, ""),

            address: Joi.string().max(100).allow(null, ""),
            comments: Joi.string().max(100).allow(null, ""),
            status: Joi.string().valid(...STATUSES).allow(null, ""),
        }), DATA, res)) return;

        try {
            const PASSWORD = req.sanitize.body.get("password");
            if (PASSWORD !== null) DATA.password = await SecurityUtil().hash(PASSWORD);
            DATA.created_at = DateUtil().sql();

            const RESULT = await UserModel().table()
                .returning("id")
                .insert(DATA);

            res.status(200).json({id: RESULT[0]});
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    };

    update = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;

        const DATA = req.sanitize.body.only([
            "first_name", "middle_name", "last_name",
            "role_id", "phone", "email", "username", "password",
            "address", "comments", "status",
        ]);
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            middle_name: Joi.string().min(1).max(100).allow(null, ""),
            last_name: Joi.string().min(1).max(100).required(),

            role_id: Joi.number().integer().required().external(ExtendJoiUtil().exists("users")),
            phone: Joi.string().min(10).max(16).allow(null, "").external(ExtendJoiUtil().phone).external(ExtendJoiUtil().unique("users", "phone", ID)),
            email: Joi.string().email().max(180).allow(null, "").external(ExtendJoiUtil().unique("users", "email", ID)),
            username: Joi.string().min(2).max(16).pattern(/^[a-zA-Z0-9_]+$/).allow(null, "").external(ExtendJoiUtil().unique("users", "username", ID)),
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
                .allow(null, ""),

            address: Joi.string().max(100).allow(null, ""),
            comments: Joi.string().max(100).allow(null, ""),
            status: Joi.string().valid(...STATUSES).allow(null, ""),
        }), DATA, res)) return;

        try {
            const PASSWORD = req.sanitize.body.get("password");
            if (PASSWORD !== null) DATA.password = await SecurityUtil().hash(PASSWORD);
            DATA.updated_at = DateUtil().sql();

            const RESULT = await UserModel().table()
                .where("id", ID)
                .update(DATA);

            if (RESULT !== 1) return res.status(500).json({
                code: errors.UPDATE_FAILED.code,
                message: errors.UPDATE_FAILED.message,
            });

            res.status(200).send();
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    };

    delete = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const RESULT: number = await UserModel().table()
            .where("id", ID)
            .delete();

        if (RESULT !== 1) return res.status(500).json({
            code: errors.DELETE_FAILED.code,
            message: errors.DELETE_FAILED.message,
        });

        res.status(200).send();
    };
}

const UserController = new Controller();
export default UserController;