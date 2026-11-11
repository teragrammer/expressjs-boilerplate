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
exports.PasswordRecoveryController = void 0;
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
class PasswordRecoveryController {
    constructor(recoveryService) {
        this.recoveryService = recoveryService;
        this.send = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const data = req.sanitize.data;
            const result = yield this.recoveryService.sendRecoveryCode(data.type, data.send_to);
            res.status(200).json({
                status: "success",
                message: "If an account matches those credentials, a reset code has been sent.",
                data: result.nextResendAt
                    ? {
                        next_resend_at: result.nextResendAt,
                    }
                    : null,
            });
        }));
        this.validate = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            const data = req.sanitize.data;
            yield this.recoveryService.resetPassword(data.type, data.send_to, data.code, data.new_password);
            res.status(200).json({
                status: "success",
                message: "Password has been successfully reset. You can now log in with your new password.",
            });
        }));
    }
}
exports.PasswordRecoveryController = PasswordRecoveryController;
