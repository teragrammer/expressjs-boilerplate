import {Express, Request, Response, NextFunction} from 'express';
import errors from "../../configurations/errors";

export function TwoFactorAuthenticationMiddleware(app: Express, isHalt = true): any {
    return async function (req: Request, res: Response, next: NextFunction) {
        const credentials = req.credentials;

        if (!credentials && isHalt) return res.status(401).json({
            code: errors.e6.code,
            message: errors.e6.message,
        })

        if (credentials.authentication.is_tfa_required && !credentials.authentication.is_tfa_verified) return res.status(403).json({
            code: errors.e16.code,
            message: errors.e16.message,
        })

        next();
    }
}