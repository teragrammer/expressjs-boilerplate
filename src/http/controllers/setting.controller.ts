import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {DATA_TYPES, SET_CACHE_SETTINGS, SettingModel} from "../../models/setting.model";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {SettingInterface} from "../../interfaces/setting.interface";
import RedisPublisherService from "../../services/redis-publisher.service";
import SettingService from "../../services/setting.service";
import catchAsync from "../../utilities/catch-async";

class Controller {
    browse = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const Q = SettingModel().table();

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
    });

    values = catchAsync(async (req: Request, res: Response): Promise<any> => {
        res.status(200).json((await SettingService.getCache()).pub);
    });

    view = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const SETTING: SettingInterface = await SettingModel().table()
            .where("id", ID)
            .first();

        if (!SETTING) return res.status(404).send({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        return res.status(200).json(SETTING);
    });

    create = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["name", "slug", "value", "description", "type", "is_disabled", "is_public"]);
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique("settings", "slug")),
            value: Joi.any(),
            description: Joi.string().min(1).max(200),
            type: Joi.string().valid(...DATA_TYPES).required(),
            is_disabled: Joi.number().valid(0, 1).required(),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.created_at = DateUtil().sql();
            const RESULT = await SettingModel().table()
                .returning("id")
                .insert(DATA);

            // update the local cache and publish newly created setting
            if (RESULT.length) await RedisPublisherService.publishCache(SET_CACHE_SETTINGS, await SettingService.initializer());

            res.status(200).json({id: RESULT[0]});
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    });

    update = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique("settings", "slug", ID)),
            value: Joi.any(),
            description: Joi.string().min(1).max(200),
            type: Joi.string().valid(...DATA_TYPES).required(),
            is_disabled: Joi.number().valid(0, 1).required(),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.updated_at = DateUtil().sql();
            const RESULT = await SettingModel().table()
                .where("id", ID)
                .update(DATA);

            if (RESULT !== 1) return res.status(500).json({
                code: errors.UPDATE_FAILED.code,
                message: errors.UPDATE_FAILED.message,
            });

            // update the local cache and publish newly updated setting
            if (RESULT === 1) await RedisPublisherService.publishCache(SET_CACHE_SETTINGS, await SettingService.initializer());

            res.status(200).send();
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.SERVER_ERROR.code,
                message: errors.SERVER_ERROR.message,
            });
        }
    });

    delete = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const RESULT = await SettingModel().table()
            .where("id", ID)
            .delete();

        if (RESULT !== 1) {
            return res.status(500).json({
                code: errors.DELETE_FAILED.code,
                message: errors.DELETE_FAILED.message,
            });
        } else {
            // update the local cache and publish newly updated setting
            await RedisPublisherService.publishCache(SET_CACHE_SETTINGS, await SettingService.initializer());
        }

        res.status(200).json({result: RESULT === 1});
    });
}

const SettingController = new Controller();
export default SettingController;