// src/modules/auth/authentication/register.controller.ts

import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {AuthenticationService} from "./authentication.service";
import {RegisterInput} from "./authentication.interface";
import {
    setRefreshTokenCookie,
} from "../../../common/utils/refresh-token-cookie";
import {__ENV} from "../../../config/environment";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";
import {
    getClientIp,
    getUserAgent,
    getUserAgentInfo,
} from "../../../common/utils/request-info";

const REFRESH_COOKIE_MAX_AGE_MS =
    Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7) * 24 * 60 * 60 * 1000;

export class RegisterController {
    constructor(
        private readonly authService: AuthenticationService,
        private readonly auditService: AuditService,
    ) {
    }

    create = catchAsync(async (req: Request, res: Response): Promise<void> => {
        // Delegate to Business Service
        const result = await this.authService.register(
            req.sanitize.data as unknown as RegisterInput,
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

        await this.auditService.success(AUDIT_ACTIONS.USER_CREATED, {
            request: req,
            actorUserId: result.userId ?? null,
            targetType: "user",
            targetId: result.userId ?? null,
        });

        res.status(201).json({
            token: result.accessToken,
            access_token: result.accessToken,
            expires_at: result.expiresAt,
            tfa_required: Boolean(result.tfaRequired),
        });
    });
}
