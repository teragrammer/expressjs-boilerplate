import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {DateUtil} from "../../utilities/date.util";
import {RoleModel} from "../../models/role.model";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {RoleInterface} from "../../interfaces/role.interface";
import catchAsync from "../../utilities/catch-async";

class Controller {
    browse = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const Q = RoleModel().table();

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
    });

    view = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const ROLE: RoleInterface = await RoleModel().table()
            .where("id", ID)
            .first();

        if (!ROLE) return res.status(404).send({
            code: errors.DATA_NOT_FOUND.code,
            message: errors.DATA_NOT_FOUND.message,
        });

        return res.status(200).json(ROLE);
    });

    create = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["name", "slug", "description", "is_public", "is_bypass_authorization"]);
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique("roles", "slug")),
            description: Joi.string().max(100).allow(null, ""),
            is_public: Joi.number().valid(0, 1).required(),
            is_bypass_authorization: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.created_at = DateUtil().sql();
            const RESULT = await RoleModel().table()
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
    });

    update = catchAsync(async (req: Request, res: Response): Promise<any> => {
        const ID = req.params.id;
        const DATA = req.sanitize.body.only(["name", "slug", "description", "is_public", "is_bypass_authorization"]);
        if (await ExtendJoiUtil().response(Joi.object({
            name: Joi.string().min(1).max(50).required(),
            slug: Joi.string().min(1).max(50).required().external(ExtendJoiUtil().unique("roles", "slug", ID)),
            description: Joi.string().max(100).allow(null, ""),
            is_public: Joi.number().valid(0, 1).required(),
            is_bypass_authorization: Joi.number().valid(0, 1).required(),
        }), DATA, res)) return;

        try {
            DATA.updated_at = DateUtil().sql();
            const RESULT: number = await RoleModel().table()
                .where("id", ID)
                .update(DATA);

            if (RESULT !== 1) return res.status(500).json({
                code: errors.UPDATE_FAILED.code,
                message: errors.UPDATE_FAILED.message,
            });

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
        const RESULT: number = await RoleModel().table()
            .where("id", ID)
            .delete();

        if (RESULT !== 1) return res.status(500).json({
            code: errors.DELETE_FAILED.code,
            message: errors.DELETE_FAILED.message,
        });

        res.status(200).send();
    });
}

const RoleController = new Controller();
export default RoleController;