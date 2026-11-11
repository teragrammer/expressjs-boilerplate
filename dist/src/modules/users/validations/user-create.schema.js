"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userCreateSchema = void 0;
// src/modules/users/validations/user-create.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const validations_1 = require("../../../shared/validations");
const user_interface_1 = require("../user.interface");
exports.userCreateSchema = joi_1.default.object({
    first_name: joi_1.default.string().min(1).max(100).required(),
    middle_name: joi_1.default.string().min(1).max(100).allow(null, ""),
    last_name: joi_1.default.string().min(1).max(100).required(),
    address: joi_1.default.string().max(100).allow(null, ""),
    comments: joi_1.default.string().max(100).allow(null, ""),
    status: joi_1.default.string().valid(...user_interface_1.STATUSES).allow(null, ""),
    role_id: joi_1.default.number().integer().required()
        .external((0, validations_1.validateExists)("roles", { column: "id" })),
    phone: joi_1.default.string().min(10).max(16).allow(null, "")
        .external((0, validations_1.validateUnique)("users", "phone")),
    email: joi_1.default.string().email().max(180).allow(null, "")
        .external((0, validations_1.validateUnique)("users", "email")),
    username: joi_1.default.string().min(2).max(16).pattern(/^[a-zA-Z0-9_]+$/).allow(null, "")
        .external((0, validations_1.validateUnique)("users", "username"))
        .required(),
    password: joi_1.default.string().min(8).max(32)
        .pattern(/[A-Z]/) // At least one uppercase letter
        .pattern(/[a-z]/) // At least one lowercase letter
        .pattern(/[0-9]/) // At least one number
        .pattern(/[^A-Za-z0-9]/) // At least one special character (e.g., !, @, #)
        .messages({
        "string.min": "Password should be at least 8 characters long.",
        "string.max": "Password should be no longer than 32 characters.",
        "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character.",
        "any.required": "Password is required.",
    })
        .required(),
});
