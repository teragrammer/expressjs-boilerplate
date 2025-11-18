import {NextFunction, Request, Response} from "express";
import errors from "../../configurations/errors";
import {AuthenticationTokenInterface} from "../../interfaces/authentication-token.interface";
import {AuthenticationTokenModel, JwtExtendedPayload} from "../../models/authentication-token.model";
import {UserInterface} from "../../interfaces/user.interface";
import AuthenticationTokenService from "../../services/data/authentication-token.service";
import UserRepository from "../../repositories/user.repository";

export function AuthenticationMiddleware(isHalt = true): any {
    const USER = async (payload: JwtExtendedPayload): Promise<UserInterface> =>
        UserRepository.byId(payload.uid);

    const AUTHENTICATION = (payload: JwtExtendedPayload): Promise<AuthenticationTokenInterface> =>
        AuthenticationTokenModel().table().where("id", payload.tid).first();

    return async function (req: Request, res: Response, next: NextFunction) {
        const AUTH_HEADER = req.headers.authorization;
        if (!AUTH_HEADER) return res.status(401).json({
            code: "AUTH_HEADER",
            message: errors.INVALID_AUTH_TOKEN.message,
        });
        const TOKEN: string = AUTH_HEADER.startsWith("Bearer ") ? AUTH_HEADER.slice(7) : AUTH_HEADER;

        const PAYLOAD: boolean | JwtExtendedPayload = await AuthenticationTokenService.validate(TOKEN);
        if (PAYLOAD === false && isHalt) return res.status(401).json({
            code: "AUTH_EXPIRED",
            message: errors.EXPIRED_AUTH_TOKEN.message,
        });

        if (PAYLOAD !== false) {
            const PAYLOAD_CONVERTED = PAYLOAD as JwtExtendedPayload;
            req.credentials = {
                jwt: PAYLOAD_CONVERTED,
                user: async () => USER(PAYLOAD_CONVERTED),
                authentication: async () => AUTHENTICATION(PAYLOAD_CONVERTED),
            };
        }

        next();
    };
}