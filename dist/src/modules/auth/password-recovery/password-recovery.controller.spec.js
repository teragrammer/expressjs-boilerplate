"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const password_recovery_controller_1 = require("./password-recovery.controller");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
(0, vitest_1.describe)("PasswordRecoveryController Unit Tests", () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let mockRecoveryService;
    let controller;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        mockRecoveryService = {
            sendRecoveryCode: vitest_1.vi.fn(),
            resetPassword: vitest_1.vi.fn(),
        };
        controller = new password_recovery_controller_1.PasswordRecoveryController(mockRecoveryService);
        mockRes = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn().mockReturnThis(),
        };
        mockNext = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("send", () => {
        (0, vitest_1.it)("should send a recovery code successfully for an email", () => __awaiter(void 0, void 0, void 0, function* () {
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
            };
            controller.send(mockReq, mockRes, mockNext);
            yield vitest_1.vi.waitFor(() => {
                (0, vitest_1.expect)(mockRecoveryService.sendRecoveryCode)
                    .toHaveBeenCalledWith("email", "valid@example.com");
                (0, vitest_1.expect)(mockRes.status).toHaveBeenCalledWith(200);
                (0, vitest_1.expect)(mockRes.json).toHaveBeenCalledWith({
                    status: "success",
                    message: "If an account matches those credentials, a reset code has been sent.",
                    data: {
                        next_resend_at: nextResendAt,
                    },
                });
            });
            (0, vitest_1.expect)(mockNext).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should send a recovery code successfully for a phone", () => __awaiter(void 0, void 0, void 0, function* () {
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
            };
            controller.send(mockReq, mockRes, mockNext);
            yield vitest_1.vi.waitFor(() => {
                (0, vitest_1.expect)(mockRecoveryService.sendRecoveryCode)
                    .toHaveBeenCalledWith("phone", "+14155552671");
                (0, vitest_1.expect)(mockRes.status).toHaveBeenCalledWith(200);
                (0, vitest_1.expect)(mockRes.json).toHaveBeenCalledWith({
                    status: "success",
                    message: "If an account matches those credentials, a reset code has been sent.",
                    data: null,
                });
            });
            (0, vitest_1.expect)(mockNext).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should pass service errors to next()", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new errors_1.AppError(messages_1.default.TRY_RESEND, "Rate limit");
            mockRecoveryService.sendRecoveryCode.mockRejectedValue(error);
            mockReq = {
                sanitize: {
                    data: {
                        type: "email",
                        send_to: "valid@example.com",
                    },
                },
            };
            controller.send(mockReq, mockRes, mockNext);
            yield vitest_1.vi.waitFor(() => {
                (0, vitest_1.expect)(mockNext).toHaveBeenCalledWith(error);
            });
            (0, vitest_1.expect)(mockRes.status).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockRes.json).not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("validate", () => {
        (0, vitest_1.it)("should reset the password successfully", () => __awaiter(void 0, void 0, void 0, function* () {
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
            };
            controller.validate(mockReq, mockRes, mockNext);
            yield vitest_1.vi.waitFor(() => {
                (0, vitest_1.expect)(mockRecoveryService.resetPassword)
                    .toHaveBeenCalledWith("email", "valid@example.com", "123456", "SecurePassword123");
                (0, vitest_1.expect)(mockRes.status).toHaveBeenCalledWith(200);
                (0, vitest_1.expect)(mockRes.json).toHaveBeenCalledWith({
                    status: "success",
                    message: "Password has been successfully reset. You can now log in with your new password.",
                });
            });
            (0, vitest_1.expect)(mockNext).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should pass service errors to next()", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new errors_1.AppError(messages_1.default.INVALID_CODE, "Invalid recovery code.");
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
            };
            controller.validate(mockReq, mockRes, mockNext);
            yield vitest_1.vi.waitFor(() => {
                (0, vitest_1.expect)(mockNext).toHaveBeenCalledWith(error);
            });
            (0, vitest_1.expect)(mockRes.status).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockRes.json).not.toHaveBeenCalled();
        }));
    });
});
