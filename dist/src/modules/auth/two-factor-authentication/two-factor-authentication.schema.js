"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyOtpSchema = void 0;
// src/modules/auth/two-factor-authentication/two-factor-authentication.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
exports.verifyOtpSchema = joi_1.default.object({
    code: joi_1.default.string()
        .pattern(/^\d+$/)
        .required(),
});
