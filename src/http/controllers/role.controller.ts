import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {DateUtil} from "../../utilities/date.util";
import {RoleModel} from "../../models/role.model";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {RoleInterface} from "../../interfaces/role.interface";
import {Knex} from "knex";

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = RoleModel(req.app.get("knex")).table();

        const IS_PUBLIC: any = req.sanitize.query.numeric("is_public", null);
        if (IS_PUBLIC !== null) Q.where("is_public", IS_PUBLIC);

        const KEYWORD: any = req.sanitize.query.get("search");
        if (KEYWORD !== null) {
            Q.where((queryBuilder: any) => {
                queryBuilder.where("name", "LIKE", `%${KEYWORD}%`)
                    .orWhere("slug", "LIKE", `%${KEYWORD}%`)
                    .orWhere("description", "LIKE", `%${KEYWORD}%`);
            });
        }

        const PAGINATE = req.app.get("paginate");
        const ROLES: RoleInterface[] = await Q.offset(PAGINATE.offset).limit(PAGINATE.perPage);

        res.status(200).json(ROLES);
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const ROLE: RoleInterface = await RoleModel(req.app.get("knex")).table()
            .where("id", ID)
            .first();

        if (!ROLE) return res.status(404).send({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        return res.status(200).json(ROLE);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");

        const DATA = req.sanitize.body.only(["name", "slug", "description", "is_public"]);
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(KNEX, "roles", "slug")),
            description: Joi.string().max(100).allow(null, ""),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.created_at = DateUtil().sql();
            const RESULT = await RoleModel(KNEX).table()
                .returning("id")
                .insert(DATA);

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
        const DATA = req.sanitize.body.only(["name", "slug", "description", "is_public"]);
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(KNEX, "roles", "slug", ID)),
            description: Joi.string().max(100).allow(null, ""),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.updated_at = DateUtil().sql();
            const RESULT = await RoleModel(KNEX).table()
                .where("id", ID)
                .update(DATA);

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
        const ID = req.params.id;
        const RESULT = await RoleModel(req.app.get("knex")).table()
            .where("id", ID)
            .delete();

        res.status(200).json({result: RESULT === 1});
    };
}

const RoleController = new Controller();
export default RoleController;