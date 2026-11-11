// src/modules/auth/authentication/authentication.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {AuthenticationService} from "./authentication.service";
import {LoginInput} from "./authentication.interface";
import {assertCredentials} from "../../../common/utils/request-credentials";
import {
    clearRefreshTokenCookie,
    setRefreshTokenCookie,
} from "../../../common/utils/refresh-token-cookie";
import {__ENV} from "../../../config/environment";
import {SessionService} from "./session.service";
import {RefreshTokenRepository} from "./refresh-token.repository";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {
    getClientIp,
    getUserAgent,
    getUserAgentInfo,
} from "../../../common/utils/request-info";

/**
 * Refresh token lifetime in milliseconds.
 */
const REFRESH_COOKIE_MAX_AGE_MS =
    Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7) * 24 * 60 * 60 * 1000;

export class AuthenticationController {
    constructor(
        private readonly authService: AuthenticationService,
        private readonly sessionService: SessionService,
        private readonly refreshTokenRepository: RefreshTokenRepository,
        private readonly auditService: AuditService,
    ) {
    }

    login = catchAsync(async (req: Request, res: Response) => {
        // Delegate to Business Service
        const result = await this.authService.login(
            req.sanitize.data as unknown as LoginInput,
            {
                ip: getClientIp(req),
                ...getUserAgentInfo(req),
                userAgent: getUserAgent(req) ?? null,
            },
        );

        if (result.refreshToken) {
            setRefreshTokenCookie(
                res,
                result.refreshToken,
                REFRESH_COOKIE_MAX_AGE_MS,
            );
        }

        await this.auditService.success(AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED, {
            request: req,
            actorUserId: result.userId ?? null,
            targetType: "user",
            targetId: result.userId ?? null,
        });

        res.status(200).json({
            token: result.accessToken,
            access_token: result.accessToken,
            expires_at: result.expiresAt,
            tfa_required: Boolean(result.tfaRequired),
            tfaRequired: Boolean(result.tfaRequired),
        });
    });

    logout = catchAsync(async (req: Request, res: Response) => {
        assertCredentials(req);

        await this.authService.logout(req.credentials.jwt.tid);

        clearRefreshTokenCookie(res);

        await this.auditService.success(AUDIT_ACTIONS.AUTH_LOGOUT, {
            request: req,
        });

        res.sendStatus(204);
    });

    /**
     * Revokes every session belonging to the caller.
     */
    logoutAll = catchAsync(async (req: Request, res: Response) => {
        assertCredentials(req);

        const revoked = await this.authService.logoutAll(
            req.credentials.jwt.uid,
        );

        clearRefreshTokenCookie(res);

        await this.auditService.success(AUDIT_ACTIONS.AUTH_LOGOUT_ALL, {
            request: req,
            metadata: {revokedSessions: revoked},
        });

        res.sendStatus(204);
    });

    /**
     * Lists the caller's active sessions.
     */
    sessions = catchAsync(async (req: Request, res: Response) => {
        assertCredentials(req);

        const sessions = await this.refreshTokenRepository.findActiveByUserId(
            req.credentials.jwt.uid,
        );

        res.status(200).json({
            sessions: sessions.map((session) => ({
                id: session.id,
                session_id: session.session_id,
                ip: session.ip,
                user_agent: session.user_agent,
                created_at: session.created_at,
                expires_at: session.expires_at,
            })),
        });
    });
}
