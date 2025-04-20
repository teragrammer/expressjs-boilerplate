import {Express, Request, Response} from "express";
import Joi from "joi";
import errors from "../../configurations/errors";
import {UserModel} from "../../models/user.model";
import {logger} from "../../configurations/logger";
import {SecurityUtil} from "../../utilities/security.util";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";

export default (app: Express) => {
    return {
        async information(req: Request, res: Response): Promise<any> {
            const data = req.body;
            const schema = Joi.object({
                first_name: Joi.string().min(1).max(100).required(),
                middle_name: Joi.string().min(1).max(100),
                last_name: Joi.string().min(1).max(100).required(),
            });

            if (await ExtendJoiUtil().response(schema, data, res)) return;

            try {
                const updates = await UserModel(app.knex).table()
                    .where('id', req.credentials.user.id)
                    .where('status', 'Activated')
                    .update({
                        first_name: data.first_name,
                        middle_name: data.middle_name || null,
                        last_name: data.last_name,
                        address: data.address || null,
                    })

                res.status(200).json({result: updates === 1});
            } catch (e) {
                logger.error(e);

                res.status(500).json({
                    code: errors.e4.code,
                    message: errors.e4.message,
                });
            }
        },

        async password(req: Request, res: Response): Promise<any> {
            const data = req.body;
            const schema = Joi.object({
                current_password: Joi.string().required(),
                new_password: Joi.string().min(6).max(32),
                username: Joi.string().min(2).max(16),
                email: Joi.string().email().max(180),
                phone: Joi.string().min(10).max(16).custom(ExtendJoiUtil().phone, 'Phone Number Validation'),
            });

            if (await ExtendJoiUtil().response(schema, data, res)) return;

            // verify the current password
            const account = req.credentials.user;
            if (!account.password || !await SecurityUtil().compare(account.password, data.current_password)) {
                return res.status(403).json({
                    code: errors.e11.code,
                    message: errors.e11.message,
                });
            }

            const _data: any = {}

            // hashed if new password
            if (typeof data.new_password !== 'undefined' && data.new_password !== '') {
                _data.password = await SecurityUtil().hash(data.new_password)
            }

            // check if username has no duplicate
            if (typeof data.username !== 'undefined' && data.username !== '') {
                const username = await UserModel(app.knex).table()
                    .where('id', '<>', account.id)
                    .where('username', data.username)
                    .first();

                if (username) return res.status(400).json({
                    code: errors.e2.code,
                    message: errors.e2.message,
                });

                _data.username = data.username;
            }

            // check if email has no duplicate
            if (typeof data.email !== 'undefined' && data.email !== '') {
                const email = await UserModel(app.knex).table()
                    .where('id', '<>', account.id)
                    .where('email', data.email)
                    .first();

                if (email) return res.status(400).json({
                    code: errors.e2.code,
                    message: errors.e2.message,
                });

                _data.email = data.email;
            }

            // check if phone has no duplicate
            if (typeof data.phone !== 'undefined' && data.phone !== '') {
                const phone = await UserModel(app.knex).table()
                    .where('id', '<>', account.id)
                    .where('phone', data.phone)
                    .first();

                if (phone) return res.status(400).json({
                    code: errors.e2.code,
                    message: errors.e2.message,
                });

                _data.phone = data.phone;
            }

            try {
                const updates = await UserModel(app.knex).table()
                    .where('id', account.id)
                    .where('status', 'Activated')
                    .update(_data)

                res.status(200).json({result: updates === 1});
            } catch (e) {
                logger.error(e);

                res.status(500).json({
                    code: errors.e4.code,
                    message: errors.e4.message,
                });
            }
        },
    }
}