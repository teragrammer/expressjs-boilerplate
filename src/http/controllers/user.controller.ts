import {Express, Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {UserModel, STATUSES} from "../../models/user.model";
import {logger} from "../../configurations/logger";
import {SecurityUtil} from "../../utilities/security.util";
import {UserInterface} from "../../interfaces/user.interface";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {ValidationUtil} from "../../utilities/validation.util";

const FORM_VALIDATOR: any = {
    first_name: Joi.string().min(1).max(100).required(),
    middle_name: Joi.string().min(1).max(100),
    last_name: Joi.string().min(1).max(100).required(),
    address: Joi.string().max(100),
    comments: Joi.string().max(100),
    password: Joi.string().min(6).max(32),
    status: Joi.string().valid(...STATUSES)
}

export default (app: Express) => {
    FORM_VALIDATOR.role_id = Joi.number().integer().required().external(ExtendJoiUtil().exists(app.knex, 'users'))

    return {
        async browse(req: Request, res: Response): Promise<any> {
            const q = UserModel(app.knex).table();

            const roleId: any = req.query.role_id;
            if (typeof roleId !== 'undefined' && !isNaN(roleId)) q.where('role_id', roleId);

            const status: any = req.query.status;
            if (typeof status !== 'undefined') q.where('status', status);

            const searchString: any = req.query.search;
            if (typeof searchString !== 'undefined') {
                q.where((queryBuilder: any) => {
                    queryBuilder.where('first_name', 'LIKE', `%${searchString}%`)
                        .orWhere('middle_name', 'LIKE', `%${searchString}%`)
                        .orWhere('last_name', 'LIKE', `%${searchString}%`)
                        .orWhere('username', 'LIKE', `%${searchString}%`)
                        .orWhere('phone', 'LIKE', `%${searchString}%`)
                        .orWhere('email', 'LIKE', `%${searchString}%`);
                });
            }

            const paginate = app.paginate(req);
            const users: UserInterface[] = await q
                .offset(paginate.offset).limit(paginate.perPage);

            for (let i = 0; i < users.length; i++) {
                delete users[i].password;
            }

            res.status(200).json(users);
        },

        async view(req: Request, res: Response): Promise<any> {
            const ID = req.params.id;
            if (ValidationUtil().isInteger(ID)) return res.status(400).send({
                code: errors.e15.code,
                message: errors.e15.message,
            });

            const user: UserInterface = await UserModel(app.knex).table()
                .where('id', ID)
                .first()

            if (!user) return res.status(404).send({
                code: errors.e3.code,
                message: errors.e3.message,
            });

            delete user.password;

            return res.status(200).json(user);
        },

        async create(req: Request, res: Response): Promise<any> {
            const data = req.body;
            FORM_VALIDATOR.phone = Joi.string().min(10).max(16).external(ExtendJoiUtil().phone).external(ExtendJoiUtil().unique(app.knex, 'users', 'phone'))
            FORM_VALIDATOR.email = Joi.string().email().max(180).external(ExtendJoiUtil().unique(app.knex, 'users', 'email'))
            FORM_VALIDATOR.username = Joi.string().min(2).max(16).external(ExtendJoiUtil().unique(app.knex, 'users', 'username'))
            if (await ExtendJoiUtil().response(Joi.object(FORM_VALIDATOR), data, res)) return;

            try {
                let password = null;
                if (data.password) password = await SecurityUtil().hash(data.password);

                const inserted = await UserModel(app.knex).table()
                    .returning('id')
                    .insert({
                        first_name: data.first_name,
                        middle_name: data.middle_name || null,
                        last_name: data.last_name,
                        address: data.address || null,
                        comments: data.comments || null,
                        role_id: data.role_id,
                        username: data.username || null,
                        phone: data.phone || null,
                        email: data.email || null,
                        password: password,
                        created_at: DateUtil().sql()
                    })

                res.status(200).json({id: inserted[0]});
            } catch (e) {
                logger.error(e);

                res.status(500).json({
                    code: errors.e4.code,
                    message: errors.e4.message,
                });
            }
        },

        async update(req: Request, res: Response): Promise<any> {
            const ID = req.params.id;
            if (ValidationUtil().isInteger(ID)) return res.status(400).send({
                code: errors.e15.code,
                message: errors.e15.message,
            });

            const data = req.body;
            FORM_VALIDATOR.phone = Joi.string().min(10).max(16).external(ExtendJoiUtil().phone).external(ExtendJoiUtil().unique(app.knex, 'users', 'phone', ID))
            FORM_VALIDATOR.email = Joi.string().email().max(180).external(ExtendJoiUtil().unique(app.knex, 'users', 'email', ID))
            FORM_VALIDATOR.username = Joi.string().min(2).max(16).external(ExtendJoiUtil().unique(app.knex, 'users', 'username', ID))
            if (await ExtendJoiUtil().response(Joi.object(FORM_VALIDATOR), data, res)) return;

            // validate for unique username
            if (typeof data.username !== 'undefined') {
                const username: UserInterface = await UserModel(app.knex).table().where('slug', data.username)
                    .where('id', '<>', ID)
                    .first();
                if (username) return res.status(400).json({
                    code: errors.e2.code,
                    message: errors.e2.message,
                });
            }

            // validate for unique phone
            if (typeof data.phone !== 'undefined') {
                const phone: UserInterface = await UserModel(app.knex).table().where('phone', data.phone)
                    .where('id', '<>', ID)
                    .first();
                if (phone) return res.status(400).json({
                    code: errors.e2.code,
                    message: errors.e2.message,
                });
            }

            // validate for unique email
            if (typeof data.email !== 'undefined') {
                const email: UserInterface = await UserModel(app.knex).table().where('email', data.email)
                    .where('id', '<>', ID)
                    .first();
                if (email) return res.status(400).json({
                    code: errors.e2.code,
                    message: errors.e2.message,
                });
            }

            try {
                let password = null;
                if (data.password) password = await SecurityUtil().hash(data.password);

                const updated = await UserModel(app.knex).table()
                    .where('id', ID)
                    .update({
                        first_name: data.first_name,
                        middle_name: data.middle_name || null,
                        last_name: data.last_name,
                        address: data.address || null,
                        comments: data.comments || null,
                        role_id: data.role_id,
                        username: data.username || null,
                        phone: data.phone || null,
                        email: data.email || null,
                        password: password,
                        updated_at: DateUtil().sql()
                    })

                res.status(200).json({result: updated === 1});
            } catch (e) {
                logger.error(e);

                res.status(500).json({
                    code: errors.e4.code,
                    message: errors.e4.message,
                });
            }
        },

        async delete(req: Request, res: Response): Promise<any> {
            const ID = req.params.id;
            if (ValidationUtil().isInteger(ID)) return res.status(400).send({
                code: errors.e15.code,
                message: errors.e15.message,
            });

            const deleted = await UserModel(app.knex).table()
                .where('id', ID)
                .delete();

            res.status(200).json({result: deleted === 1});
        },
    }
}