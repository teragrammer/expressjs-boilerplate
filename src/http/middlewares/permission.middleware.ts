import {Request, Response, NextFunction} from 'express';
import errors from "../../configurations/errors";
import {UserInterface} from "../../interfaces/user.interface";

export function PermissionMiddleware(roles: string[], isHalt = true) {
    return async function (req: Request, res: Response, next: NextFunction) {
        const CREDENTIALS = req.credentials;

        if (!CREDENTIALS && isHalt) return res.status(401).json({
            code: errors.e6.code,
            message: errors.e6.message,
        })

        if (CREDENTIALS) {
            const ROLE: string = CREDENTIALS.jwt.rol
            if ((!ROLE || !roles.includes(ROLE)) && isHalt) return res.status(403).json({
                code: errors.e6.code,
                message: errors.e6.message,
            })
        }

        next();
    }
}