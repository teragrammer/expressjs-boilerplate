import {Express, Request, Response, NextFunction} from 'express';
import errors from "../../configurations/errors";
import {AuthenticationTokenInterface} from "../../interfaces/authentication-token.interface";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {UserInterface} from "../../interfaces/user.interface";
import {UserModel} from "../../models/user.model";
import {RoleModel} from "../../models/role.model";
import {JwtPayload} from "jsonwebtoken";

export function AuthenticationMiddleware(app: Express, isHalt = true): any {
    const user = async (payload: JwtPayload): Promise<UserInterface> =>
        UserModel(app.knex).profile(payload.uid);
    const authentication = (payload: JwtPayload): Promise<AuthenticationTokenInterface> =>
        AuthenticationTokenModel(app.knex).table().where('id', payload.tid).first();

    return async function (req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({code: errors.e5.code, message: errors.e5.message});
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

        const payload = await AuthenticationTokenModel(app.knex).validate(token);
        if (payload === false && isHalt) return res.status(401).json({
            code: errors.e6.code,
            message: errors.e6.message,
        });

        if (payload !== false) {
            const _payload = payload as JwtPayload;
            req.credentials = {
                jwt: _payload,
                user: async () => user(_payload),
                authentication: async () => authentication(_payload),
            }
        }

        next();
    }
}