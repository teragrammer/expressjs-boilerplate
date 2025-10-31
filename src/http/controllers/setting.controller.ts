import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {CACHE_SETT_NAME, DATA_TYPES, SettingModel} from "../../models/setting.model";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {SettingInterface} from "../../interfaces/setting.interface";
import {Knex} from "knex";
import {SettingService} from "../../services/data/setting.service";
import {PUBLISHING_CACHE} from "../../services/redis/redis-publisher.service";

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = SettingModel(req.app.get("knex")).table();

        const IS_DISABLED: any = req.sanitize.query.numeric("is_disabled", null);
        if (IS_DISABLED !== null) Q.where("is_disabled", IS_DISABLED);

        const IS_PUBLIC: any = req.sanitize.query.numeric("is_public", null);
        if (IS_PUBLIC !== null) Q.where("is_public", IS_PUBLIC);

        const TYPE: any = req.sanitize.query.get("type");
        if (TYPE !== null) Q.where("type", TYPE);

        const KEYWORD: any = req.sanitize.query.get("search");
        if (KEYWORD !== null) {
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
        res.status(200).json(req.app.get(CACHE_SETT_NAME)().pub);
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const SETTING: SettingInterface = await SettingModel(req.app.get("knex")).table()
            .where("id", ID)
            .first();

        if (!SETTING) return res.status(404).send({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        return res.status(200).json(SETTING);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");

        const DATA = req.sanitize.body.only(["name", "slug", "value", "description", "type", "is_disabled", "is_public"]);
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(KNEX, "settings", "slug")),
            value: Joi.any(),
            description: Joi.string().min(1).max(200),
            type: Joi.string().valid(...DATA_TYPES).required(),
            is_disabled: Joi.number().valid(0, 1).required(),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.created_at = DateUtil().sql();
            const RESULT = await SettingModel(KNEX).table()
                .returning("id")
                .insert(DATA);

            // update the local cache and publish newly created setting
            if (RESULT.length) await PUBLISHING_CACHE(req, CACHE_SETT_NAME, await SettingService().initializer(req.app.get("knex")));

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
        const KNEX: Knex = req.app.get("knex");

        const ID = req.params.id;
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(KNEX, "settings", "slug", ID)),
            value: Joi.any(),
            description: Joi.string().min(1).max(200),
            type: Joi.string().valid(...DATA_TYPES).required(),
            is_disabled: Joi.number().valid(0, 1).required(),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.updated_at = DateUtil().sql();
            const RESULT = await SettingModel(KNEX).table()
                .where("id", ID)
                .update(DATA);

            // update the local cache and publish newly updated setting
            if (RESULT === 1) await PUBLISHING_CACHE(req, CACHE_SETT_NAME, await SettingService().initializer(req.app.get("knex")));

            res.status(200).json({result: RESULT === 1});
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    };

    delete = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");

        const ID = req.params.id;
        const RESULT = await SettingModel(KNEX).table()
            .where("id", ID)
            .delete();

        // update the local cache and publish newly updated setting
        if (RESULT === 1) await PUBLISHING_CACHE(req, CACHE_SETT_NAME, await SettingService().initializer(req.app.get("knex")));

        res.status(200).json({result: RESULT === 1});
    };
}

const SettingController = new Controller();
export default SettingController;