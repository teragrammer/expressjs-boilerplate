// src/modules/auth/authentication/authentication-refresh.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {SessionService} from "./session.service";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";
import {
    readRefreshTokenCookie,
    setRefreshTokenCookie,
} from "../../../common/utils/refresh-token-cookie";
import {__ENV} from "../../../config/environment";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {
    getClientIp,
    getUserAgent,
} from "../../../common/utils/request-info";

const REFRESH_COOKIE_MAX_AGE_MS =
    Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7) * 24 * 60 * 60 * 1000;

export class AuthenticationRefreshController {
    constructor(
        private readonly sessionService: SessionService,
        private readonly auditService: AuditService,
    ) {
    }

    /**
     * Exchanges a refresh token for a new access/refresh pair.
     *
     * The refresh token is read from the `HttpOnly` cookie. Rotation
     * is enforced: presenting an already-used token revokes the whole
     * family.
     */
    refresh = catchAsync(async (req: Request, res: Response) => {
        const refreshToken = readRefreshTokenCookie(req);

        if (!refreshToken) {
            throw new AppError(
                Messages.INVALID_TOKEN,
                "No refresh token was supplied.",
            );
        }

        try {
            const issued = await this.sessionService.rotate(refreshToken, {
                ip: getClientIp(req),
                userAgent: getUserAgent(req) ?? null,
            });

            setRefreshTokenCookie(
                res,
                issued.refreshToken,
                REFRESH_COOKIE_MAX_AGE_MS,
            );

            await this.auditService.success(
                AUDIT_ACTIONS.AUTH_TOKEN_REFRESHED,
                {request: req},
            );

            res.status(200).json({
                token: issued.accessToken,
                access_token: issued.accessToken,
                expires_at: issued.expiresAt,
            });
        } catch (error) {
            await this.auditService.failure(
                AUDIT_ACTIONS.AUTH_TOKEN_REUSE_DETECTED,
                {
                    request: req,
                    metadata: {
                        reason: (error as Error).message,
                    },
                },
            );

            throw error;
        }
    });
}
