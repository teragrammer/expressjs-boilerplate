"use strict";
// src/modules/auth/password-recovery/password-recovery-validate.schema.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordRecoveryValidateSchema = void 0;
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const password_recovery_interface_1 = require("./password-recovery.interface");
exports.passwordRecoveryValidateSchema = joi_1.default.object({
    type: joi_1.default.string().valid(...password_recovery_interface_1.TYPES).required(),
    send_to: joi_1.default.string().required().when("type", {
        is: password_recovery_interface_1.RECOVERY_EMAIL,
        then: joi_1.default.string().email().max(100),
        otherwise: joi_1.default.string().min(1).max(18).phone(),
    }),
    code: joi_1.default.string().length(6).required(),
    new_password: joi_1.default.string().min(8).max(32)
        .pattern(/[A-Z]/)
        .pattern(/[a-z]/)
        .pattern(/[0-9]/)
        .pattern(/[^A-Za-z0-9]/)
        .messages({
        "string.min": "Password should be at least 8 characters long.",
        "string.max": "Password should be no longer than 32 characters.",
        "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
        "any.required": "Password is required.",
    })
        .required(),
});
