import {NextFunction, Request, Response} from "express";
import errors from "../../configurations/errors";

export function TwoFactorAuthenticationMiddleware(isHalt = true): any {
    return async function (req: Request, res: Response, next: NextFunction) {
        const credentials = req.credentials;

        if (!credentials && isHalt) return res.status(401).json({
            code: "AUTH_OTP_EXPIRED",
            message: errors.EXPIRED_AUTH_TOKEN.message,
        });

        if (credentials.jwt.tfa === "hol") return res.status(403).json({
            code: "AUTH_OTP_INCOMPLETE",
            message: errors.INCOMPLETE_OTP.message,
        });

        next();
    };
}