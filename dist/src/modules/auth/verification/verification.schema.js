"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationSchema = void 0;
// src/modules/auth/verification/verification.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
/**
 * Schema for a verification send/confirm request.
 *
 * Both endpoints accept a single field: the target to verify, or the
 * code to confirm.
 */
exports.sendVerificationSchema = joi_1.default.object({
    email: joi_1.default.string().email().max(180).allow(null, ""),
    phone: joi_1.default.string().min(10).max(16).allow(null, ""),
    code: joi_1.default.string().min(6).max(128).allow(null, ""),
}).or("email", "phone", "code");
