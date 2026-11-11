"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountPasswordSchema = void 0;
// src/modules/users/validations/account-information.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const unique_1 = require("../../../shared/validations/database/unique");
const accountPasswordSchema = (userId) => joi_1.default.object({
    current_password: joi_1.default.string().required(),
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
    username: joi_1.default.string().min(2).max(16).pattern(/^[a-zA-Z0-9_]+$/)
        .external((0, unique_1.validateCompositeUnique)("users", ["username"], { ignoreId: userId }))
        .allow(null, ""),
    email: joi_1.default.string().email().max(180)
        .external((0, unique_1.validateCompositeUnique)("users", ["email"], { ignoreId: userId }))
        .allow(null, ""),
    phone: joi_1.default.string().min(10).max(16)
        .phone()
        .external((0, unique_1.validateCompositeUnique)("users", ["phone"], { ignoreId: userId }))
        .allow(null, ""),
});
exports.accountPasswordSchema = accountPasswordSchema;
