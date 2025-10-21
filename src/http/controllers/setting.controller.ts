import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {SettingModel, DATA_TYPES} from "../../models/setting.model";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {ValidationUtil} from "../../utilities/validation.util";
import {SettingInterface} from "../../interfaces/setting.interface";
import {Knex} from "knex";

const FORM_VALIDATOR = Joi.object({
    name: Joi.string().min(1).max(50).required(),
    slug: Joi.string().min(1).max(50).required(),
    value: Joi.any(),
    description: Joi.string().min(1).max(200),
    type: Joi.string().valid(...DATA_TYPES).required(),
    is_disabled: Joi.number().valid(0, 1).required(),
    is_public: Joi.number().valid(0, 1).required(),
});

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = SettingModel(req.app.get("knex")).table();

        const IS_DISABLED: any = req.query.is_disabled;
        if (typeof IS_DISABLED !== "undefined" && !isNaN(IS_DISABLED)) Q.where("is_disabled", IS_DISABLED);

        const IS_PUBLIC: any = req.query.is_public;
        if (typeof IS_PUBLIC !== "undefined" && !isNaN(IS_PUBLIC)) Q.where("is_public", IS_PUBLIC);

        const TYPE: any = req.query.type;
        if (typeof TYPE !== "undefined" && !isNaN(TYPE)) Q.where("type", TYPE);

        const KEYWORD: any = req.query.search;
        if (typeof KEYWORD !== "undefined") {
            Q.where((queryBuilder: any) => {
                queryBuilder.where("name", "LIKE", `%${KEYWORD}%`)
                    .orWhere("slug", "LIKE", `%${KEYWORD}%`)
                    .orWhere("value", "LIKE", `%${KEYWORD}%`)
                    .orWhere("description", "LIKE", `%${KEYWORD}%`);
            });
        }

        const PAGINATE = req.app.get("paginate");
        const SETTINGS: SettingInterface[] = await Q.offset(PAGINATE.offset).limit(PAGINATE.perPage);

        res.status(200).json(SETTINGS);
    };

    values = async (req: Request, res: Response): Promise<any> => {
        res.status(200).json(await SettingModel(req.app.get("knex")).value([], 1));
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        if (ValidationUtil().isInteger(ID)) return res.status(400).send({
            code: errors.e15.code,
            message: errors.e15.message,
        });

        const SETTING: SettingInterface = await SettingModel(req.app.get("knex")).table()
            .where("id", ID)
            .first();

        if (!SETTING) return res.status(404).send({
            code: errors.e3.code,
            message: errors.e3.message,
        });

        return res.status(200).json(SETTING);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.body;
        if (await ExtendJoiUtil().response(FORM_VALIDATOR, DATA, res)) return;

        const KNEX: Knex = req.app.get("knex");

        // validate for unique slug
        const SLUG: SettingInterface = await SettingModel(KNEX).table().where("slug", DATA.slug).first();
        if (SLUG) return res.status(400).json({
            code: errors.e2.code,
            message: errors.e2.message,
        });

        try {
            const RESULT = await SettingModel(KNEX).table()
                .returning("id")
                .insert({
                    name: DATA.name,
                    slug: DATA.slug,
                    value: typeof DATA.value ? DATA.value : undefined,
                    description: typeof DATA.description ? DATA.description : null,
                    type: DATA.type,
                    is_disabled: DATA.is_disabled,
                    is_public: DATA.is_public,
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

        const DATA = req.body;
        if (await ExtendJoiUtil().response(FORM_VALIDATOR, DATA, res)) return;

        const KNEX: Knex = req.app.get("knex");

        // validate for unique slug
        const SLUG: SettingInterface = await SettingModel(KNEX).table()
            .where("slug", DATA.slug)
            .where("id", "<>", ID)
            .first();
        if (SLUG) return res.status(400).json({
            code: errors.e2.code,
            message: errors.e2.message,
        });

        try {
            const RESULT = await SettingModel(KNEX).table()
                .where("id", ID)
                .update({
                    name: DATA.name,
                    slug: DATA.slug,
                    value: typeof DATA.value ? DATA.value : undefined,
                    description: typeof DATA.description ? DATA.description : null,
                    type: DATA.type,
                    is_disabled: DATA.is_disabled,
                    is_public: DATA.is_public,
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

        const RESULT = await SettingModel(res.app.get("knex")).table()
            .where("id", ID)
            .delete();

        res.status(200).json({result: RESULT === 1});
    };
}

const SettingController = new Controller();
export default SettingController;