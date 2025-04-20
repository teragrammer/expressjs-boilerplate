import {Express, Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {SettingModel, DATA_TYPES} from "../../models/setting.model";
import {SettingInterface} from "../../interfaces/setting.interface";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {ValidationUtil} from "../../utilities/validation.util";

const FORM_VALIDATOR = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    slug: Joi.string().min(1).max(50).required(),
    value: Joi.any(),
    description: Joi.string().min(1).max(200),
    type: Joi.string().valid(...DATA_TYPES).required(),
    is_disabled: Joi.number().valid(0, 1).required(),
    is_public: Joi.number().valid(0, 1).required(),
})

export default (app: Express) => {
    return {
        async browse(req: Request, res: Response): Promise<any> {
            const q = SettingModel(app.knex).table();

            const isDisabled: any = req.query.is_disabled;
            if (typeof isDisabled !== 'undefined' && !isNaN(isDisabled)) q.where('is_disabled', isDisabled);

            const isPublic: any = req.query.is_public;
            if (typeof isPublic !== 'undefined' && !isNaN(isPublic)) q.where('is_public', isPublic);

            const type: any = req.query.type;
            if (typeof type !== 'undefined' && !isNaN(type)) q.where('type', type);

            const searchString: any = req.query.search;
            if (typeof searchString !== 'undefined') {
                q.where((queryBuilder: any) => {
                    queryBuilder.where('name', 'LIKE', `%${searchString}%`)
                        .orWhere('slug', 'LIKE', `%${searchString}%`)
                        .orWhere('value', 'LIKE', `%${searchString}%`)
                        .orWhere('description', 'LIKE', `%${searchString}%`);
                });
            }

            const paginate = app.paginate(req);
            const settings: SettingInterface[] = await q
                .offset(paginate.offset).limit(paginate.perPage);

            res.status(200).json(settings);
        },

        async values(req: Request, res: Response): Promise<any> {
            res.status(200).json(await SettingModel(app.knex).value([], 1));
        },

        async view(req: Request, res: Response): Promise<any> {
            const ID = req.params.id;
            if (ValidationUtil().isInteger(ID)) return res.status(400).send({
                code: errors.e15.code,
                message: errors.e15.message,
            });

            const setting: SettingInterface = await SettingModel(app.knex).table()
                .where('id', ID)
                .first()

            if (!setting) return res.status(404).send({
                code: errors.e3.code,
                message: errors.e3.message,
            });

            return res.status(200).json(setting);
        },

        async create(req: Request, res: Response): Promise<any> {
            const data = req.body;

            if (await ExtendJoiUtil().response(FORM_VALIDATOR, data, res)) return;

            // validate for unique slug
            const slug: SettingInterface = await SettingModel(app.knex).table().where('slug', data.slug).first();
            if (slug) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });

            try {
                const inserted = await SettingModel(app.knex).table()
                    .returning('id')
                    .insert({
                        name: data.name,
                        slug: data.slug,
                        value: data.value || null,
                        description: data.description || null,
                        type: data.type,
                        is_disabled: data.is_disabled,
                        is_public: data.is_public,
                        created_at: DateUtil().sql(),
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
            if (await ExtendJoiUtil().response(FORM_VALIDATOR, data, res)) return;

            // validate for unique slug
            const slug: SettingInterface = await SettingModel(app.knex).table()
                .where('slug', data.slug)
                .where('id', '<>', ID)
                .first();
            if (slug) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });

            const setting: SettingInterface = await SettingModel(app.knex).table().where('id', ID).first();
            if (!setting) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
            });

            try {
                const updated = await SettingModel(app.knex).table()
                    .where('id', ID)
                    .update({
                        name: data.name,
                        slug: data.slug,
                        value: data.value || null,
                        description: data.description || null,
                        type: data.type,
                        is_disabled: data.is_disabled,
                        is_public: data.is_public,
                        updated_at: DateUtil().sql(),
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

            const deleted = await SettingModel(app.knex).table()
                .where('id', ID)
                .delete();

            res.status(200).json({result: deleted === 1});
        },
    }
}