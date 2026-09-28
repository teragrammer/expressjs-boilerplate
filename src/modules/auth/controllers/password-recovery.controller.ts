// src/modules/auth/controllers/password-recovery.controller.ts
import {Request, Response} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {PasswordRecoveryService} from "../services/password-recovery.service";
import {Type} from "../interfaces/password.recovery.interface";

interface PasswordRecoverySendRequest {
    type: Type;
    send_to: string;
}

interface PasswordRecoveryValidateRequest
    extends PasswordRecoverySendRequest {
    code: string;
    new_password: string;
}

export class PasswordRecoveryController {
    constructor(
        private readonly recoveryService: PasswordRecoveryService,
    ) {
    }

    send = catchAsync(
        async (
            req: Request,
            res: Response,
        ): Promise<void> => {
            const data = req.sanitize.data as unknown as PasswordRecoverySendRequest;

            const result =
                await this.recoveryService.sendRecoveryCode(
                    data.type,
                    data.send_to,
                );

            res.status(200).json({
                status: "success",
                message:
                    "If an account matches those credentials, a reset code has been sent.",
                data: result.nextResendAt
                    ? {
                        next_resend_at:
                        result.nextResendAt,
                    }
                    : null,
            });
        },
    );

    validate = catchAsync(
        async (
            req: Request,
            res: Response,
        ): Promise<void> => {
            const data = req.sanitize.data as unknown as PasswordRecoveryValidateRequest;

            await this.recoveryService.resetPassword(
                data.type,
                data.send_to,
                data.code,
                data.new_password,
            );

            res.status(200).json({
                status: "success",
                message:
                    "Password has been successfully reset. You can now log in with your new password.",
            });
        },
    );
}
