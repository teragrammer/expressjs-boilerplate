import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {RouteGuardInterface} from "../../interfaces/route-guard.interface";
import {RouteGuardModel, SET_CACHE_GUARDS} from "../../models/route-guard.model";
import RedisPublisherService from "../../services/redis-publisher.service";
import RouteGuardService from "../../services/route-guard.service";

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = RouteGuardModel().table();

        const ROLE_ID: any = req.sanitize.query.numeric("role_id", null);
        if (ROLE_ID !== null) Q.where("role_id", ROLE_ID);

        const PAGINATE = req.app.get("paginate");
        const ROUTE_GUARDS: RouteGuardInterface[] = await Q.offset(PAGINATE.offset).limit(PAGINATE.perPage);

        res.status(200).json(ROUTE_GUARDS);
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const ROUTE_GUARD: RouteGuardInterface = await RouteGuardModel().table()
            .where("id", ID)
            .first();

        if (!ROUTE_GUARD) return res.status(404).send({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        return res.status(200).json(ROUTE_GUARD);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["role_id", "route"]);
        if (await ExtendJoiUtil().response(Joi.object({
            role_id: Joi.number().integer().required().external(ExtendJoiUtil().exists("roles")),
            route: Joi.string().min(3).max(100).required(),
        }), DATA, res)) return;

        try {
            const [ID] = await RouteGuardModel().table()
                .returning("id")
                .insert(DATA);

            // update the local cache and publish newly updated setting
            if (ID) await RedisPublisherService.publishCache(SET_CACHE_GUARDS, await RouteGuardService.initializer());

            res.status(200).json({id: ID});
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
        const RESULT = await RouteGuardModel().table()
            .where("id", ID)
            .delete();

        if (RESULT !== 1) {
            return res.status(500).json({
                code: errors.DELETE_FAILED.code,
                message: errors.DELETE_FAILED.message,
            });
        } else {
            // update the local cache and publish newly updated setting
            await RedisPublisherService.publishCache(SET_CACHE_GUARDS, await RouteGuardService.initializer());
        }

        res.status(200).json({result: RESULT === 1});
    };
}

const RouteGuardController = new Controller();
export default RouteGuardController;