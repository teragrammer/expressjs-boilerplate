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

const SCHEMA = Joi.object({
    first_name: Joi.string().min(2).max(100).required(),
    middle_name: Joi.string().min(2).max(100),
    last_name: Joi.string().min(1).max(100).required(),
    username: Joi.string().min(3).max(16).required(),
    password: Joi.string().min(6).max(32).required(),
    email: Joi.string().email().max(180).required(),
});

class Controller {
    create = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.body;
        if (await ExtendJoiUtil().response(SCHEMA, DATA, res)) return;

        const KNEX: Knex = req.app.get("knex");

        // check for duplicate username
        const USERNAME = await UserModel(KNEX).table().where("username", DATA.username).first();
        if (USERNAME) return res.status(400).json({
            code: errors.e2.code,
            message: errors.e2.message,
        });

        // check for duplicate email
        if (DATA.email) {
            const EMAIL = await UserModel(KNEX).table().where("email", DATA.email).first();
            if (EMAIL) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });
        }

        // check if role is valid
        const ROLE: RoleInterface = await KNEX.table("roles").where("slug", "customer").first();
        if (!ROLE) return res.status(404).json({
            code: errors.e3.code,
            message: errors.e3.message,
        });

        try {
            // create the new user
            const CUSTOMER_ID: any = await UserModel(KNEX).table().returning("id").insert({
                first_name: DATA.first_name || null,
                middle_name: DATA.middle_name || null,
                last_name: DATA.last_name || null,
                role_id: ROLE.id,
                username: DATA.username,
                email: DATA.email || null,
                password: await SecurityUtil().hash(DATA.password),
                created_at: DateUtil().sql(),
            });
            if (!CUSTOMER_ID.length) return res.status(500).json({
                code: errors.e4.code,
                message: errors.e4.message,
            });

            // get the full details
            const CUSTOMER: UserInterface = await UserModel(KNEX).table().where("id", CUSTOMER_ID[0]).first();
            if (!CUSTOMER) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
            });

            const AUTHENTICATION = await AuthenticationTokenModel(KNEX).generate(CUSTOMER);

            res.status(200).json({
                user: AUTHENTICATION.user,
                credential: AUTHENTICATION.token,
            });
        } catch (e: any) {
            logger.error(e);

            res.status(500).json({
                code: errors.e4.code,
                message: errors.e4.message,
            });
        }
    };
}

const RegisterController = new Controller();
export default RegisterController;