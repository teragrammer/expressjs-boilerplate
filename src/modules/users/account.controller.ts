// src/modules/users/account.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../common/utils/catch-async";
import {SecurityAccountDTO, UpdateUserDTO} from "./user.interface";
import {AccountService} from "./account.service";
import {assertCredentials} from "../../common/utils/request-credentials";
import {setRefreshTokenCookie} from "../../common/utils/refresh-token-cookie";
import {__ENV} from "../../config/environment";
import {IssuedTokens} from "../auth/authentication/session.service";

const REFRESH_COOKIE_MAX_AGE_MS =
    Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7) * 24 * 60 * 60 * 1000;

export class AccountController {
    constructor(
        private readonly accountService: AccountService,
    ) {
    }

    information = catchAsync(async (req: Request, res: Response): Promise<any> => {
        assertCredentials(req);
        const issued = await this.accountService.information(
            req.credentials.jwt.uid,
            req.sanitize.data as UpdateUserDTO,
            req.credentials.jwt.tid,
            req.credentials.jwt.tfa,
        );

        res.status(200).json(issued.accessToken);
    });

    password = catchAsync(async (req: Request, res: Response): Promise<any> => {
        assertCredentials(req);
        const issued: IssuedTokens = await this.accountService.password(
            await req.credentials.user(),
            req.sanitize.data as unknown as SecurityAccountDTO,
            req.credentials.jwt.tid,
            req.credentials.jwt.tfa,
        );

        /*
         * The session was rotated: the caller needs the new refresh
         * token, otherwise the old one points at a revoked session.
         */
        if (issued.refreshToken) {
            setRefreshTokenCookie(
                res,
                issued.refreshToken,
                REFRESH_COOKIE_MAX_AGE_MS,
            );
        }

        res.status(200).json(issued.accessToken);
    });
}
