import {Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {logger} from "../../configurations/logger";
import {UserModel} from "../../models/user.model";
import {SecurityUtil} from "../../utilities/security.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {Knex} from "knex";

class Controller {
    information = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            first_name: Joi.string().min(1).max(100).required(),
            middle_name: Joi.string().min(1).max(100).allow(null, ""),
            last_name: Joi.string().min(1).max(100).required(),
        }), DATA, res)) return;

        try {
            const RESULT = await UserModel(req.app.get("knex")).table()
                .where("id", req.credentials.jwt.uid)
                .where("status", "Activated")
                .update({
                    first_name: DATA.first_name,
                    middle_name: typeof DATA.middle_name !== undefined ? DATA.middle_name : null,
                    last_name: DATA.last_name,
                    address: typeof DATA.address !== undefined ? DATA.address : null,
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

    password = async (req: Request, res: Response): Promise<any> => {
        const DATA = req.body;
        if (await ExtendJoiUtil().response(Joi.object({
            current_password: Joi.string().required(),
            new_password: Joi.string().min(6).max(32),
            username: Joi.string().min(2).max(16),
            email: Joi.string().email().max(180),
            phone: Joi.string().min(10).max(16).custom(ExtendJoiUtil().phone, "Phone Number Validation"),
        }), DATA, res)) return;

        // verify the current password
        const ACCOUNT = await req.credentials.user();
        if (!ACCOUNT.password || !await SecurityUtil().compare(ACCOUNT.password, DATA.current_password)) {
            return res.status(403).json({
                code: errors.e11.code,
                message: errors.e11.message,
            });
        }

        const KNEX: Knex = req.app.get("knex");
        const FORMATED_DATA: any = {};

        // hashed if new password
        if (typeof DATA.new_password !== "undefined" && DATA.new_password !== "") {
            FORMATED_DATA.password = await SecurityUtil().hash(DATA.new_password);
        }

        // check if username has no duplicate
        if (typeof DATA.username !== "undefined" && DATA.username !== "") {
            const USERNAME = await UserModel(KNEX).table()
                .where("id", "<>", ACCOUNT.id)
                .where("username", DATA.username)
                .first();

            if (USERNAME) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });

            FORMATED_DATA.username = DATA.username;
        }

        // check if email has no duplicate
        if (typeof DATA.email !== "undefined" && DATA.email !== "") {
            const EMAIL = await UserModel(KNEX).table()
                .where("id", "<>", ACCOUNT.id)
                .where("email", DATA.email)
                .first();

            if (EMAIL) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });

            FORMATED_DATA.email = DATA.email;
        }

        // check if phone has no duplicate
        if (typeof DATA.phone !== "undefined" && DATA.phone !== "") {
            const PHONE = await UserModel(KNEX).table()
                .where("id", "<>", ACCOUNT.id)
                .where("phone", DATA.phone)
                .first();

            if (PHONE) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });

            FORMATED_DATA.phone = DATA.phone;
        }

        try {
            const RESULT = await UserModel(KNEX).table()
                .where("id", ACCOUNT.id)
                .where("status", "Activated")
                .update(FORMATED_DATA);

            res.status(200).json({result: RESULT === 1});
        } catch (e) {
            logger.error(e);

            res.status(500).json({
                code: errors.e4.code,
                message: errors.e4.message,
            });
        }
    };
}

const AccountController = new Controller();
export default AccountController;