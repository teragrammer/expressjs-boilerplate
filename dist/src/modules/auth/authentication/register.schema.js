"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSchema = void 0;
// src/modules/auth/authentication/register.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const validations_1 = require("../../../shared/validations");
exports.registerSchema = joi_1.default.object({
    first_name: joi_1.default.string().trim().min(2).max(100).required(),
    middle_name: joi_1.default.string().trim().min(2).max(100).allow(null, ""),
    last_name: joi_1.default.string().trim().min(2).max(100).required(),
    // Security/Performance optimization: uniquely validate via async external extensions
    username: joi_1.default.string()
        .trim()
        .min(3)
        .max(16)
        .pattern(/^[a-zA-Z0-9_]+$/)
        .required()
        .external((0, validations_1.validateUnique)('users', 'username')),
    email: joi_1.default.string()
        .trim()
        .email()
        .max(180)
        .required()
        .external((0, validations_1.validateUnique)('users', 'email')),
    password: joi_1.default.string()
        .min(8)
        .max(32)
        .pattern(/[A-Z]/) // At least one uppercase letter
        .pattern(/[a-z]/) // At least one lowercase letter
        .pattern(/[0-9]/) // At least one number
        .pattern(/[^A-Za-z0-9]/) // At least one special character
        .messages({
        "string.min": "Password should be at least 8 characters long.",
        "string.max": "Password should be no longer than 32 characters.",
        "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
        "any.required": "Password is required.",
    })
        .required(),
});
