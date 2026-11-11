"use strict";
// src/modules/auth/password-recovery/password-recovery-validate.schema.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordRecoveryValidateSchema = void 0;
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const password_recovery_interface_1 = require("./password-recovery.interface");
const password_1 = require("../../../shared/validations/password");
exports.passwordRecoveryValidateSchema = joi_1.default.object({
    type: joi_1.default.string().valid(...password_recovery_interface_1.TYPES).required(),
    send_to: joi_1.default.string().required().when("type", {
        is: password_recovery_interface_1.RECOVERY_EMAIL,
        then: joi_1.default.string().email().max(100),
        otherwise: joi_1.default.string().min(1).max(18).phone(),
    }),
    code: joi_1.default.string().length(6).required(),
    new_password: password_1.passwordSchema,
});
