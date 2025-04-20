import {Express, Request, Response, NextFunction} from 'express';
import errors from "../../configurations/errors";
import {AuthenticationTokenInterface} from "../../interfaces/authentication-token.interface";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {UserInterface} from "../../interfaces/user.interface";
import {UserModel} from "../../models/user.model";
import {RoleModel} from "../../models/role.model";

export function AuthenticationMiddleware(app: Express, isHalt = true): any {
    return async function (req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({code: errors.e5.code, message: errors.e5.message});
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

        let authenticationToken: AuthenticationTokenInterface | boolean = await AuthenticationTokenModel(app.knex).validate(token);
        if (authenticationToken === false && isHalt) return res.status(401).json({
            code: errors.e6.code,
            message: errors.e6.message,
        });

        // do not continue adding the user details
        // only continue if halt is required
        if (authenticationToken !== false) {
            authenticationToken = authenticationToken as AuthenticationTokenInterface;

            const user: UserInterface = await UserModel(app.knex).table().where('id', authenticationToken.user_id).first();
            if (user.status !== 'Activated') return res.status(401).json({
                code: errors.e7.code,
                message: errors.e7.message,
            });

            // add the role information
            user.role = await RoleModel(app.knex).table().where('id', user.role_id).first();

            req.credentials = {
                user,
                authentication: authenticationToken,
            }
        }

        next();
    }
}