import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {UserModel} from "../../models/user.model";
import {SecurityUtil} from "../../utilities/security.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {Knex} from "knex";
import {DateUtil} from "../../utilities/date.util";

class Controller {
    information = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.sanitize.body.only(["first_name", "middle_name", "last_name", "address"]);
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            middle_name: Joi.string().min(1).max(100).allow(null, ""),
            last_name: Joi.string().min(1).max(100).required(),
            address: Joi.string().max(100).allow(null, ""),
        }), DATA, res)) return;

        try {
            DATA.updated_at = DateUtil().sql();
            const RESULT = await UserModel(req.app.get("knex")).table()
                .where("id", req.credentials.jwt.uid)
                .where("status", "Activated")
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

    password = async (req: Request, res: Response): Promise<any> => {
        const KNEX: Knex = req.app.get("knex");
        const ACCOUNT = await req.credentials.user();

        const DATA = req.sanitize.body.only(["current_password", "new_password", "username", "email", "phone"]);
        if (await ExtendJoiUtil().response(Joi.object({
            current_password: Joi.string().required(),
            new_password: Joi.string().min(6).max(32),
            username: Joi.string().min(2).max(16).custom(ExtendJoiUtil().unique(KNEX, "users", "username", ACCOUNT.id), errors.DUPLICATE_DATA.message),
            email: Joi.string().email().max(180).custom(ExtendJoiUtil().unique(KNEX, "users", "email", ACCOUNT.id), errors.DUPLICATE_DATA.message),
            phone: Joi.string().min(10).max(16)
                .custom(ExtendJoiUtil().phone, "Phone Number Validation")
                .custom(ExtendJoiUtil().unique(KNEX, "users", "phone", ACCOUNT.id), errors.DUPLICATE_DATA.message),
        }), DATA, res)) return;

        // verify the current password
        if (!ACCOUNT.password || !await SecurityUtil().compare(ACCOUNT.password, DATA.current_password)) {
            return res.status(403).json({
                code: errors.CREDENTIAL_DO_NOT_MATCH.code,
                message: errors.CREDENTIAL_DO_NOT_MATCH.message,
            });
        }

        // hashed if new password
        if (typeof DATA.new_password !== "undefined" && DATA.new_password !== null) DATA.password = await SecurityUtil().hash(DATA.new_password);

        try {
            // remove non-column keys
            if (typeof DATA.current_password !== "undefined") delete DATA.current_password;
            if (typeof DATA.new_password !== "undefined") delete DATA.new_password;

            DATA.updated_at = DateUtil().sql();
            const RESULT = await UserModel(KNEX).table()
                .where("id", ACCOUNT.id)
                .where("status", "Activated")
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
}

const AccountController = new Controller();
export default AccountController;