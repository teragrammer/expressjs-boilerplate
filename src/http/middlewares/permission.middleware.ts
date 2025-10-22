import {NextFunction, Request, Response} from "express";
import errors from "../../configurations/errors";

export function PermissionMiddleware(roles: string[], isHalt = true) {
    return async function (req: Request, res: Response, next: NextFunction) {
        const CREDENTIALS = req.credentials;

        if (!CREDENTIALS && isHalt) return res.status(401).json({
            code: "AUTH_PERM_EXPIRED",
            message: errors.EXPIRED_AUTH_TOKEN.message,
        });

        if (CREDENTIALS) {
            const ROLE: string | undefined = CREDENTIALS.jwt.rol;
            if ((!ROLE || !roles.includes(ROLE)) && isHalt) return res.status(403).json({
                code: "AUTH_PERM_UNAUTHORIZED",
                message: errors.NO_PERMISSION.message,
            });
        }

        next();
    };
}