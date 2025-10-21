import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {DateUtil} from "../../utilities/date.util";
import {RoleModel} from "../../models/role.model";
import {ValidationUtil} from "../../utilities/validation.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {RoleInterface} from "../../interfaces/role.interface";
import {Knex} from "knex";

class Controller {
    browse = async (req: Request, res: Response): Promise<any> => {
        const Q = RoleModel(req.app.get("knex")).table();

        const IS_PUBLIC: any = req.query.is_public;
        if (typeof IS_PUBLIC !== "undefined" && !isNaN(IS_PUBLIC)) Q.where("is_public", IS_PUBLIC);

        const KEYWORD: any = req.query.search;
        if (typeof KEYWORD !== "undefined") {
            Q.where((queryBuilder: any) => {
                queryBuilder.where("name", "LIKE", `%${KEYWORD}%`)
                    .orWhere("slug", "LIKE", `%${KEYWORD}%`)
                    .orWhere("description", "LIKE", `%${KEYWORD}%`);
            });
        }

        const PAGINATE = req.app.get("paginate")(req);
        const ROLES: RoleInterface[] = await Q.offset(PAGINATE.offset).limit(PAGINATE.perPage);

        res.status(200).json(ROLES);
    };

    view = async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        if (ValidationUtil().isInteger(ID)) return res.status(400).send({
            code: errors.e15.code,
            message: errors.e15.message,
        });

        const ROLE: RoleInterface = await RoleModel(req.app.get("knex")).table()
            .where("id", ID)
            .first();

        if (!ROLE) return res.status(404).send({
            code: errors.e3.code,
            message: errors.e3.message,
        });

        return res.status(200).json(ROLE);
    };

    create = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");

        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(KNEX, "roles", "slug")),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            const RESULT = await RoleModel(KNEX).table()
                .returning("id")
                .insert({
                    name: DATA.name,
                    slug: DATA.slug,
                    description: typeof DATA.description ? DATA.description : null,
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

        const KNEX: Knex = req.app.get("knex");
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique(KNEX, "roles", "slug", ID)),
            is_public: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            const RESULT = await RoleModel(KNEX).table()
                .where("id", ID)
                .update({
                    name: DATA.name,
                    slug: DATA.slug,
                    description: typeof DATA.description ? DATA.description : null,
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

        const RESULT = await RoleModel(req.app.get("knex")).table()
            .where("id", ID)
            .delete();

        res.status(200).json({result: RESULT === 1});
    };
}

const RoleController = new Controller();
export default RoleController;