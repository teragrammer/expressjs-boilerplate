import {Express, Request, Response} from "express";
import Joi from "joi";
import {ExtendJoiUtil} from "../../utilities/extend-joi.util";
import {UserModel} from "../../models/user.model";
import errors from "../../configurations/errors";
import {RoleInterface} from "../../interfaces/role.interface";
import {SecurityUtil} from "../../utilities/security.util";
import {DateUtil} from "../../utilities/date.util";
import {UserInterface} from "../../interfaces/user.interface";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {logger} from "../../configurations/logger";

const SCHEMA = Joi.object({
    first_name: Joi.string().min(2).max(100).required(),
    middle_name: Joi.string().min(2).max(100),
    last_name: Joi.string().min(1).max(100).required(),
    username: Joi.string().min(3).max(16).required(),
    password: Joi.string().min(6).max(32).required(),
    email: Joi.string().email().max(180).required(),
});

export default (app: Express) => {
    return {
        async create(req: Request, res: Response): Promise<any> {
            const data = req.body;
            if (await ExtendJoiUtil().response(SCHEMA, data, res)) return;

            // check for duplicate username
            const username = await UserModel(app.knex).table().where('username', data.username).first();
            if (username) return res.status(400).json({
                code: errors.e2.code,
                message: errors.e2.message,
            });

            // check for duplicate email
            if (data.email) {
                const email = await UserModel(app.knex).table().where('email', data.email).first();
                if (email) return res.status(400).json({
                    code: errors.e2.code,
                    message: errors.e2.message,
                });
            }

            // check if role is valid
            const role: RoleInterface = await app.knex.table('roles').where('slug', 'customer').first();
            if (!role) return res.status(404).json({
                code: errors.e3.code,
                message: errors.e3.message,
            });

            try {
                // create the new user
                const customerId: any = await UserModel(app.knex).table().returning('id').insert({
                    first_name: data.first_name || null,
                    middle_name: data.middle_name || null,
                    last_name: data.last_name || null,
                    role_id: role.id,
                    username: data.username,
                    email: data.email || null,
                    password: await SecurityUtil().hash(data.password),
                    created_at: DateUtil().sql(),
                });
                if (!customerId.length) return res.status(500).json({
                    code: errors.e4.code,
                    message: errors.e4.message,
                });

                // get the full details
                const customer: UserInterface = await UserModel(app.knex).table().where('id', customerId[0]).first();
                if (!customer) return res.status(404).json({
                    code: errors.e3.code,
                    message: errors.e3.message,
                });

                const authentication = await AuthenticationTokenModel(app.knex).generate(customer);

                res.status(200).json({
                    user: authentication.user,
                    credential: authentication.token,
                })
            } catch (e: any) {
                logger.error(e);

                res.status(500).json({
                    code: errors.e4.code,
                    message: errors.e4.message,
                });
            }
        }
    }
}