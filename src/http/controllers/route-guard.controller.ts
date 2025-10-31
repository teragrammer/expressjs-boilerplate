import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {DateUtil} from "../../utilities/date.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {Knex} from "knex";
import {RouteGuardInterface} from "../../interfaces/route-guard.interface";
import {CACHE_GUARD_NAME, RouteGuardModel} from "../../models/route-guard.model";
import {RouteGuardService} from "../../services/data/route-guard.service";
import {PUBLISHING_CACHE} from "../../services/redis/redis-publisher.service";

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = RouteGuardModel(req.app.get("knex")).table();

        const ROLE_ID: any = req.sanitize.query.numeric("role_id", null);
        if (ROLE_ID !== null) Q.where("role_id", ROLE_ID);

        const PAGINATE = req.app.get("paginate");
        const ROUTE_GUARDS: RouteGuardInterface[] = await Q.offset(PAGINATE.offset).limit(PAGINATE.perPage);

        res.status(200).json(ROUTE_GUARDS);
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const ROUTE_GUARD: RouteGuardInterface = await RouteGuardModel(req.app.get("knex")).table()
            .where("id", ID)
            .first();

        if (!ROUTE_GUARD) return res.status(404).send({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        return res.status(200).json(ROUTE_GUARD);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");

        const DATA = req.sanitize.body.only(["role_id", "route"]);
        if (await ExtendJoiUtil().response(Joi.object({
            role_id: Joi.number().integer().required().external(ExtendJoiUtil().exists(KNEX, "roles")),
            route: Joi.string().min(3).max(100).required(),
        }), DATA, res)) return;

        try {
            const RESULT: any[] = await KNEX.transaction(async (trx: any) => {
                // remove old data or duplicate
                await RouteGuardModel(trx).table()
                    .where("role_id", DATA.role_id)
                    .where("route", DATA.route).delete();

                // insert the new data
                DATA.created_at = DateUtil().sql();

                // update the local cache and publish newly updated setting
                return RouteGuardModel(trx).table()
                    .returning("id")
                    .insert(DATA);
            });

            // update the local cache and publish newly updated setting
            if (RESULT.length) await PUBLISHING_CACHE(req, CACHE_GUARD_NAME, await RouteGuardService().initializer(req.app.get("knex")));

            res.status(200).json({id: RESULT[0]});
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
        const RESULT = await RouteGuardModel(KNEX).table()
            .where("id", ID)
            .delete();

        // update the local cache and publish newly updated setting
        if (RESULT === 1) await PUBLISHING_CACHE(req, CACHE_GUARD_NAME, await RouteGuardService().initializer(req.app.get("knex")));

        res.status(200).json({result: RESULT === 1});
    };
}

const RouteGuardController = new Controller();
export default RouteGuardController;