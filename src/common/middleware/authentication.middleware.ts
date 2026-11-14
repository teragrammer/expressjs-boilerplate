// src/common/middleware/authentication.middleware.ts
import {NextFunction, Request, Response} from "express";
import {JwtExtendedPayload} from "../../modules/auth/authentication/authentication.interface";
import {AppError} from "../utils/errors";

// 🧠 IMPORT from your isolated container instead of hardcoding instantiations here!
import {authService, tokenService, userService} from "../../config/container";
import Messages from "../utils/messages";

export interface AuthenticationMiddlewareOptions {
    /**
     * Allows a session that has not completed the second factor.
     *
     * Only the TFA challenge endpoints (and logout) may opt in: every
     * other authenticated route requires a full session.
     */
    allowPendingTfa?: boolean;
}

export function AuthenticationMiddleware(
    isHalt = true,
    options: AuthenticationMiddlewareOptions = {},
): any {
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
                    return await userService.findAuthById(payload.uid);
                },
                authentication: async () => {
                    return await authService.findAuthenticationToken(payload);
                }
            };

            // Enforce server-side session existence for revocable tokens.
            // All tokens must have a valid tid > 0 and corresponding session.
            if (!payload.tid || payload.tid <= 0) {
                if (isHalt) {
                    return next(new AppError(Messages.UNAUTHORIZED, "Invalid session token"));
                }
                return next();
            }

            const session = await req.credentials.authentication();

            /*
             * A pending-TFA token is a login-stage credential, not a
             * full session. Reject it by default so a password-only
             * attacker cannot use it on ordinary protected routes.
             *
             * Both the signed claim and the durable session state must
             * agree: checking only one of them would allow a stale or
             * forged claim to bypass the gate.
             */
            if (
                !options.allowPendingTfa &&
                (payload.tfa !== true || session.tfa_verified !== true)
            ) {
                if (isHalt) {
                    return next(
                        new AppError(
                            Messages.INCOMPLETE_OTP,
                            "You must complete OTP verification to access this section.",
                            "AUTH_OTP_INCOMPLETE",
                        ),
                    );
                }

                return next();
            }

            return next();
        } catch (err) {
            return next(err);
        }
    };
}