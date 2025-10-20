import {Request, Response, NextFunction} from 'express';
import errors from "../../configurations/errors";
import {UserInterface} from "../../interfaces/user.interface";

export function PermissionMiddleware(roles: string[], isHalt = true) {
    return async function (req: Request, res: Response, next: NextFunction) {
        const credentials = req.credentials;

        if (!credentials && isHalt) return res.status(401).json({
            code: errors.e6.code,
            message: errors.e6.message,
        })

        if (credentials) {
            const role: string = credentials.jwt.rol
            if ((!role || !roles.includes(role)) && isHalt) return res.status(403).json({
                code: errors.e6.code,
                message: errors.e6.message,
            })
        }

        next();
    }
}