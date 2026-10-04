// src/common/middleware/authentication.middleware.ts
import {NextFunction, Request, Response} from "express";
import {JwtExtendedPayload} from "../../modules/auth/authentication/authentication.interface";
import {AppError} from "../utils/errors";

// 🧠 IMPORT from your isolated container instead of hardcoding instantiations here!
import {authService, tokenService, userService} from "../../config/container";
import Messages from "../utils/messages";

export function AuthenticationMiddleware(isHalt = true): any {
    return async function (req: Request, res: Response, next: NextFunction) {
        try {
            // Extract and validate authorization header structure
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                if (isHalt) {
                    return next(new AppError(Messages.UNAUTHORIZED, "Authorization token missing or malformed"));
                }
                return next(); // Keeps req.credentials clean/undefined instead of crashing on null
            }

            const token = authHeader.split(" ")[1];

            // Decode and parse token signature
            let payload: JwtExtendedPayload;
            try {
                payload = tokenService.verifyToken(token) as JwtExtendedPayload;
            } catch (error) {
                if (isHalt) {
                    return next(new AppError(Messages.UNAUTHORIZED, "Invalid or expired authentication token"));
                }
                return next();
            }

            // Bind dynamic lazy promises checking fully structured DB returns
            req.credentials = {
                jwt: payload,
                user: async () => {
                    return await userService.findById(payload.uid);
                },
                authentication: async () => {
                    return await authService.findAuthenticationToken(payload);
                }
            };

            return next();
        } catch (err) {
            return next(err);
        }
    };
}