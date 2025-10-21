import {Request, Response, Router} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {UserModel, STATUSES} from "../../models/user.model";
import {logger} from "../../configurations/logger";
import {SecurityUtil} from "../../utilities/security.util";
import {UserInterface} from "../../interfaces/user.interface";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {ValidationUtil} from "../../utilities/validation.util";
import {Knex} from "knex";

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = UserModel(req.app.get("knex")).table();

        const ROLE_ID: any = req.query.role_id;
        if (typeof ROLE_ID !== "undefined" && !isNaN(ROLE_ID)) Q.where("role_id", ROLE_ID);

        const STATUS: any = req.query.status;
        if (typeof STATUS !== "undefined") Q.where("status", STATUS);

        const KEYWORD: any = req.query.search;
        if (typeof KEYWORD !== "undefined") {
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
        for (let i = 0; i < USERS.length; i++) delete USERS[i].password;

        res.status(200).json(USERS);
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        if (ValidationUtil().isInteger(ID)) return res.status(400).send({
            code: errors.e15.code,
            message: errors.e15.message,
        });

        const USER: UserInterface = await UserModel(req.app.get("knex")).table()
            .where("id", ID)
            .first();

        if (!USER) return res.status(404).send({
            code: errors.e3.code,
            message: errors.e3.message,
        });

        // remove sensitive data
        delete USER.password;

        return res.status(200).json(USER);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");

        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            middle_name: Joi.string().min(1).max(100),
            last_name: Joi.string().min(1).max(100).required(),

            role_id: Joi.number().integer().required().external(ExtendJoiUtil().exists(KNEX, "users")),
            phone: Joi.string().min(10).max(16).external(ExtendJoiUtil().phone).external(ExtendJoiUtil().unique(KNEX, "users", "phone")),
            email: Joi.string().email().max(180).external(ExtendJoiUtil().unique(KNEX, "users", "email")),
            username: Joi.string().min(2).max(16).external(ExtendJoiUtil().unique(KNEX, "users", "username")),
            password: Joi.string().min(6).max(32),

            address: Joi.string().max(100),
            comments: Joi.string().max(100),
            status: Joi.string().valid(...STATUSES),
        }), DATA, res)) return;

        try {
            let password = null;
            if (DATA.password) password = await SecurityUtil().hash(DATA.password);

            const RESULT = await UserModel(KNEX).table()
                .returning("id")
                .insert({
                    first_name: DATA.first_name,
                    middle_name: typeof DATA.middle_name ? DATA.middle_name : null,
                    last_name: DATA.last_name,
                    address: typeof DATA.address ? DATA.address : null,
                    comments: typeof DATA.comments ? DATA.comments : null,
                    role_id: DATA.role_id,
                    username: typeof DATA.username ? DATA.username : null,
                    phone: typeof DATA.phone ? DATA.phone : null,
                    email: typeof DATA.email ? DATA.email : null,
                    password: password,
                    created_at: DateUtil().sql(),
                });

            res.status(200).json({id: RESULT[0]});
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.e4.code,
                message: errors.e4.message,
            });
        }
    };

    update = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        if (ValidationUtil().isInteger(ID)) return res.status(400).send({
            code: errors.e15.code,
            message: errors.e15.message,
        });

        const KNEX: Knex = req.app.get("knex");
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            middle_name: Joi.string().min(1).max(100),
            last_name: Joi.string().min(1).max(100).required(),

            role_id: Joi.number().integer().required().external(ExtendJoiUtil().exists(KNEX, "users")),
            phone: Joi.string().min(10).max(16).external(ExtendJoiUtil().phone).external(ExtendJoiUtil().unique(KNEX, "users", "phone", ID)),
            email: Joi.string().email().max(180).external(ExtendJoiUtil().unique(KNEX, "users", "email", ID)),
            username: Joi.string().min(2).max(16).external(ExtendJoiUtil().unique(KNEX, "users", "username", ID)),
            password: Joi.string().min(6).max(32),

            address: Joi.string().max(100),
            comments: Joi.string().max(100),
            status: Joi.string().valid(...STATUSES),
        }), DATA, res)) return;

        // validate for unique username
        if (typeof DATA.username !== "undefined") {
            const USERNAME: UserInterface = await UserModel(KNEX).table().where("slug", DATA.username)
                .where("id", "<>", ID)
                .first();
            if (USERNAME) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });
        }

        // validate for unique phone
        if (typeof DATA.phone !== "undefined") {
            const PHONE: UserInterface = await UserModel(KNEX).table().where("phone", DATA.phone)
                .where("id", "<>", ID)
                .first();
            if (PHONE) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });
        }

        // validate for unique email
        if (typeof DATA.email !== "undefined") {
            const EMAIL: UserInterface = await UserModel(KNEX).table().where("email", DATA.email)
                .where("id", "<>", ID)
                .first();
            if (EMAIL) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });
        }

        try {
            let password = null;
            if (DATA.password) password = await SecurityUtil().hash(DATA.password);

            const RESULT = await UserModel(KNEX).table()
                .where("id", ID)
                .update({
                    first_name: DATA.first_name,
                    middle_name: DATA.middle_name ? DATA.middle_name : null,
                    last_name: DATA.last_name,
                    address: DATA.address ? DATA.address : null,
                    comments: DATA.comments ? DATA.comments : null,
                    role_id: DATA.role_id,
                    username: DATA.username ? DATA.username : null,
                    phone: DATA.phone ? DATA.phone : null,
                    email: DATA.email ? DATA.email : null,
                    password: password,
                    updated_at: DateUtil().sql(),
                });

            res.status(200).json({result: RESULT === 1});
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.e4.code,
                message: errors.e4.message,
            });
        }
    };

    delete = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        if (ValidationUtil().isInteger(ID)) return res.status(400).send({
            code: errors.e15.code,
            message: errors.e15.message,
        });

        const RESULT = await UserModel(req.app.get("knex")).table()
            .where("id", ID)
            .delete();

        res.status(200).json({result: RESULT === 1});
    };
}

const UserController = new Controller();
export default UserController;