// src/modules/users/controllers/account.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {SecurityAccountDTO, UpdateUserDTO} from "../user.interface";
import {AccountService} from "../services/account.service";
import {assertCredentials} from "../../../common/utils/request-credentials";

export class AccountController {
    constructor(
        private readonly accountService: AccountService,
    ) {
    }

    information = catchAsync(async (req: Request, res: Response): Promise<any> => {
        assertCredentials(req);
        const token = await this.accountService.information(
            req.credentials.jwt.uid,
            req.sanitize.data as UpdateUserDTO,
            req.credentials.jwt.tid,
            req.credentials.jwt.tfa,
        );

        res.status(200).json(token);
    });

    password = catchAsync(async (req: Request, res: Response): Promise<any> => {
        assertCredentials(req);
        const token: string = await this.accountService.password(
            await req.credentials.user(),
            req.sanitize.data as unknown as SecurityAccountDTO,
            req.credentials.jwt.tid,
        );

        res.status(200).json(token);
    });
}