import {NextFunction, Request, Response} from "express";
import errors from "../../configurations/errors";
import {GET_CACHE_GUARDS} from "../../models/route-guard.model";

export function PermissionMiddleware(route: string, isHalt = true) {
    return async function (req: Request, res: Response, next: NextFunction) {
        const CREDENTIALS = req.credentials;

        if (!CREDENTIALS && isHalt) return res.status(401).json({
            code: "AUTH_PERM_EXPIRED",
            message: errors.EXPIRED_AUTH_TOKEN.message,
        });

        if (CREDENTIALS && isHalt) {
            const GUARDS: Record<string, string[]> = await req.app.get(GET_CACHE_GUARDS)();
            const ROLE: string | undefined = CREDENTIALS.jwt.rol;

            if (!GUARDS || !ROLE) return res.status(403).json({
                code: "AUTH_PERM_CACHE",
                message: errors.NO_PERMISSION.message,
            });

            if (typeof GUARDS[ROLE] === "undefined") return res.status(403).json({
                code: "AUTH_PERM_UNDEFINED",
                message: errors.NO_PERMISSION.message,
            });

            if (!GUARDS[ROLE].includes(route)) return res.status(403).json({
                code: "AUTH_PERM_UNAUTHORIZED",
                message: errors.NO_PERMISSION.message,
            });
        }

        next();
    };
}