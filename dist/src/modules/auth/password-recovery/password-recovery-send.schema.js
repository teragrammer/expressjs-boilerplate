"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordRecoverySendSchema = void 0;
// src/modules/auth/password-recovery/password-recovery-send.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const password_recovery_interface_1 = require("./password-recovery.interface");
exports.passwordRecoverySendSchema = joi_1.default.object({
    type: joi_1.default.string().valid(...password_recovery_interface_1.TYPES).required(),
    send_to: joi_1.default.string().required().when("type", {
        is: password_recovery_interface_1.RECOVERY_EMAIL,
        then: joi_1.default.string().email().max(100),
        otherwise: joi_1.default.string().min(1).max(18).phone(),
    }),
});
