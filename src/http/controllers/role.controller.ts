import {Express, Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {RoleInterface} from "../../interfaces/role.interface";
import {logger} from "../../configurations/logger";
import {DateUtil} from "../../utilities/date.util";
import {RoleModel} from "../../models/role.model";
import {ValidationUtil} from "../../utilities/validation.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";

const FORM_VALIDATOR: any = {
    name: Joi.string().min(1).max(50).required(),
    is_public: Joi.number().valid(0, 1).required(),
}

export default (app: Express) => {
    return {
        async browse(req: Request, res: Response): Promise<any> {
            const q = RoleModel(app.knex).table();

            const isPublic: any = req.query.is_public;
            if (typeof isPublic !== 'undefined' && !isNaN(isPublic)) q.where('is_public', isPublic);

            const searchString: any = req.query.search;
            if (typeof searchString !== 'undefined') {
                q.where((queryBuilder: any) => {
                    queryBuilder.where('name', 'LIKE', `%${searchString}%`)
                        .orWhere('slug', 'LIKE', `%${searchString}%`)
                        .orWhere('description', 'LIKE', `%${searchString}%`);
                });
            }

            const paginate = app.paginate(req);
            const roles: RoleInterface[] = await q
                .offset(paginate.offset).limit(paginate.perPage);

            res.status(200).json(roles);
        },

        async view(req: Request, res: Response): Promise<any> {
            const ID = req.params.id;
            if (ValidationUtil().isInteger(ID)) return res.status(400).send({
                code: errors.e15.code,
                message: errors.e15.message,
            });

            const role: RoleInterface = await RoleModel(app.knex).table()
                .where('id', ID)
                .first()

            if (!role) return res.status(404).send({
                code: errors.e3.code,
                message: errors.e3.message,
            });

            return res.status(200).json(role);
        },

        async create(req: Request, res: Response): Promise<any> {
            const data = req.body;
            FORM_VALIDATOR.slug = Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(app.knex, 'roles', 'slug'));
            if (await ExtendJoiUtil().response(Joi.object(FORM_VALIDATOR), data, res)) return;

            try {
                const inserted = await RoleModel(app.knex).table()
                    .returning('id')
                    .insert({
                        name: data.name,
                        slug: data.slug,
                        description: data.description || null,
                        is_public: data.is_public,
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
            FORM_VALIDATOR.slug = Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(app.knex, 'roles', 'slug', ID));
            if (await ExtendJoiUtil().response(Joi.object(FORM_VALIDATOR), data, res)) return;

            try {
                const updated = await RoleModel(app.knex).table()
                    .where('id', ID)
                    .update({
                        name: data.name,
                        slug: data.slug,
                        description: data.description || null,
                        is_public: data.is_public,
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

            const deleted = await RoleModel(app.knex).table()
                .where('id', ID)
                .delete();

            res.status(200).json({result: deleted === 1});
        },
    }
}