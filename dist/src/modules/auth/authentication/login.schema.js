"use strict";
// src/modules/auth/authentication/login.schema.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
exports.loginSchema = joi_1.default.object({
    username: joi_1.default.string().trim().required(),
    password: joi_1.default.string().required(),
});
