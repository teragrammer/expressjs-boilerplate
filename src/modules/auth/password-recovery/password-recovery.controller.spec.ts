import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";
import {PasswordRecoveryService} from "./password-recovery.service";
import {PasswordRecoveryController} from "./password-recovery.controller";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";

describe("PasswordRecoveryController Unit Tests", () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;
    let mockRecoveryService: {
        sendRecoveryCode: ReturnType<typeof vi.fn>;
        resetPassword: ReturnType<typeof vi.fn>;
    };
    let controller: PasswordRecoveryController;

    beforeEach(() => {
        vi.clearAllMocks();

        mockRecoveryService = {
            sendRecoveryCode: vi.fn(),
            resetPassword: vi.fn(),
        };

        controller = new PasswordRecoveryController(
            mockRecoveryService as unknown as PasswordRecoveryService,
        );

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
        };

        mockNext = vi.fn();
    });

    describe("send", () => {
        it("should send a recovery code successfully for an email", async () => {
            const nextResendAt = new Date();

            mockRecoveryService.sendRecoveryCode.mockResolvedValue({
                sent: true,
                nextResendAt,
            });

            mockReq = {
                sanitize: {
                    data: {
                        type: "email",
                        send_to: "valid@example.com",
                    },
                },
            } as unknown as Request;

            controller.send(
                mockReq as Request,
                mockRes as Response,
                mockNext,
            );

            await vi.waitFor(() => {
                expect(mockRecoveryService.sendRecoveryCode)
                    .toHaveBeenCalledWith(
                        "email",
                        "valid@example.com",
                    );

                expect(mockRes.status).toHaveBeenCalledWith(200);

                expect(mockRes.json).toHaveBeenCalledWith({
                    status: "success",
                    message:
                        "If an account matches those credentials, a reset code has been sent.",
                    data: {
                        next_resend_at: nextResendAt,
                    },
                });
            });

            expect(mockNext).not.toHaveBeenCalled();
        });

        it("should send a recovery code successfully for a phone", async () => {
            mockRecoveryService.sendRecoveryCode.mockResolvedValue({
                sent: true,
                nextResendAt: undefined,
            });

            mockReq = {
                sanitize: {
                    data: {
                        type: "phone",
                        send_to: "+14155552671",
                    },
                },
            } as unknown as Request;

            controller.send(
                mockReq as Request,
                mockRes as Response,
                mockNext,
            );

            await vi.waitFor(() => {
                expect(mockRecoveryService.sendRecoveryCode)
                    .toHaveBeenCalledWith(
                        "phone",
                        "+14155552671",
                    );

                expect(mockRes.status).toHaveBeenCalledWith(200);

                expect(mockRes.json).toHaveBeenCalledWith({
                    status: "success",
                    message:
                        "If an account matches those credentials, a reset code has been sent.",
                    data: null,
                });
            });

            expect(mockNext).not.toHaveBeenCalled();
        });

        it("should pass service errors to next()", async () => {
            const error = new AppError(
                Messages.TRY_RESEND,
                "Rate limit",
            );

            mockRecoveryService.sendRecoveryCode.mockRejectedValue(error);

            mockReq = {
                sanitize: {
                    data: {
                        type: "email",
                        send_to: "valid@example.com",
                    },
                },
            } as unknown as Request;

            controller.send(
                mockReq as Request,
                mockRes as Response,
                mockNext,
            );

            await vi.waitFor(() => {
                expect(mockNext).toHaveBeenCalledWith(error);
            });

            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });

    describe("validate", () => {
        it("should reset the password successfully", async () => {
            mockRecoveryService.resetPassword.mockResolvedValue(true);

            mockReq = {
                sanitize: {
                    data: {
                        type: "email",
                        send_to: "valid@example.com",
                        code: "123456",
                        new_password: "SecurePassword123",
                    },
                },
            } as unknown as Request;

            controller.validate(
                mockReq as Request,
                mockRes as Response,
                mockNext,
            );

            await vi.waitFor(() => {
                expect(mockRecoveryService.resetPassword)
                    .toHaveBeenCalledWith(
                        "email",
                        "valid@example.com",
                        "123456",
                        "SecurePassword123",
                    );

                expect(mockRes.status).toHaveBeenCalledWith(200);

                expect(mockRes.json).toHaveBeenCalledWith({
                    status: "success",
                    message:
                        "Password has been successfully reset. You can now log in with your new password.",
                });
            });

            expect(mockNext).not.toHaveBeenCalled();
        });

        it("should pass service errors to next()", async () => {
            const error = new AppError(
                Messages.INVALID_CODE,
                "Invalid recovery code.",
            );

            mockRecoveryService.resetPassword.mockRejectedValue(error);

            mockReq = {
                sanitize: {
                    data: {
                        type: "email",
                        send_to: "valid@example.com",
                        code: "123456",
                        new_password: "SecurePassword123",
                    },
                },
            } as unknown as Request;

            controller.validate(
                mockReq as Request,
                mockRes as Response,
                mockNext,
            );

            await vi.waitFor(() => {
                expect(mockNext).toHaveBeenCalledWith(error);
            });

            expect(mockRes.status).not.toHaveBeenCalled();
            expect(mockRes.json).not.toHaveBeenCalled();
        });
    });
});
