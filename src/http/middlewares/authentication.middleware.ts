import {Express, Request, Response, NextFunction} from "express";
import errors from "../../configurations/errors";
import {AuthenticationTokenInterface} from "../../interfaces/authentication-token.interface";
import {AuthenticationTokenModel} from "../../models/authentication-token.model";
import {UserInterface} from "../../interfaces/user.interface";
import {UserModel} from "../../models/user.model";
import {RoleModel} from "../../models/role.model";
import {JwtPayload} from "jsonwebtoken";
import {Knex} from "knex";

export function AuthenticationMiddleware(isHalt = true): any {
    const USER = async (knex: Knex, payload: JwtPayload): Promise<UserInterface> =>
        UserModel(knex).profile(payload.uid);

    const AUTHENTICATION = (knex: Knex, payload: JwtPayload): Promise<AuthenticationTokenInterface> =>
        AuthenticationTokenModel(knex).table().where("id", payload.tid).first();

    return async function (req: Request, res: Response, next: NextFunction) {
        const KNEX: Knex = req.app.get("knex");

        const AUTH_HEADER = req.headers.authorization;
        if (!AUTH_HEADER) return res.status(401).json({code: errors.e5.code, message: errors.e5.message});
        const TOKEN = AUTH_HEADER.startsWith("Bearer ") ? AUTH_HEADER.slice(7) : AUTH_HEADER;

        const PAYLOAD = await AuthenticationTokenModel(KNEX).validate(TOKEN);
        if (PAYLOAD === false && isHalt) return res.status(401).json({
            code: errors.e6.code,
            message: errors.e6.message,
        });

        if (PAYLOAD !== false) {
            const PAYLOAD_CONVERTED = PAYLOAD as JwtPayload;
            req.credentials = {
                jwt: PAYLOAD_CONVERTED,
                user: async () => USER(KNEX, PAYLOAD_CONVERTED),
                authentication: async () => AUTHENTICATION(KNEX, PAYLOAD_CONVERTED),
            };
        }

        next();
    };
}