// src/modules/auth/controllers/authentication.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {AuthenticationService} from "../services/authentication.service";
import {LoginInput} from "../interfaces/login-input.interface";
import {assertCredentials} from "../../../common/utils/request-credentials";

export class AuthenticationController {
    constructor(
        private readonly authService: AuthenticationService,
    ) {
    }

    login = catchAsync(async (req: Request, res: Response) => {
        // Delegate to Business Service
        const result = await this.authService.login(req.sanitize.data as unknown as LoginInput);

        // Send HTTP response
        res.status(200).json(result);
    });

    logout = catchAsync(async (req: Request, res: Response) => {
        assertCredentials(req);

        await this.authService.logout(req.credentials.jwt.tid);

        res.sendStatus(204);
    });
}