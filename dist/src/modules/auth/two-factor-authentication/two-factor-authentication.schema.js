"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disableTfaSchema = exports.verifyOtpSchema = void 0;
// src/modules/auth/two-factor-authentication/two-factor-authentication.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
exports.verifyOtpSchema = joi_1.default.object({
    code: joi_1.default.string()
        .pattern(/^\d+$/)
        .length(6)
        .required()
        .messages({
        "string.length": "The OTP must be exactly 6 digits.",
        "string.pattern.base": "The OTP must contain digits only.",
    }),
});
exports.disableTfaSchema = joi_1.default.object({
    password: joi_1.default.string()
        .min(1)
        .max(128)
        .required()
        .messages({
        "any.required": "The current password is required.",
    }),
});
