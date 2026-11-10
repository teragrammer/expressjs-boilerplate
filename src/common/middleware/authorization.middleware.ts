// src/common/middleware/authorization.middleware.ts
import {NextFunction, Request, Response} from "express";
import errors from "../utils/messages";
import {routeGuardService} from "../../config/container";

export function AuthorizationMiddleware(route: string, isHalt = true) {
    return async function (req: Request, res: Response, next: NextFunction) {
        const credentials = req.credentials;

        if (!credentials && isHalt) {return res.status(401).json({
            code: "AUTH_PERM_EXPIRED",
            message: errors.EXPIRED_AUTH_TOKEN.message,
        });}

        if (credentials && isHalt) {
            const byPass: number | undefined = credentials.jwt.bpa;
            if (byPass === 1) {return next();}

            const guards: Record<string, string[]> = await routeGuardService.getCache();
            const role: string | undefined = credentials.jwt.rol;

            if (!guards || !role) {return res.status(403).json({
                code: "AUTH_PERM_CACHE",
                message: errors.NO_PERMISSION.message,
            });}

            if (typeof guards[role] === "undefined") {return res.status(403).json({
                code: "AUTH_PERM_UNDEFINED",
                message: errors.NO_PERMISSION.message,
            });}

            if (!guards[role].includes(route)) {return res.status(403).json({
                code: "AUTH_PERM_UNAUTHORIZED",
                message: errors.NO_PERMISSION.message,
            });}
        }

        next();
    };
}