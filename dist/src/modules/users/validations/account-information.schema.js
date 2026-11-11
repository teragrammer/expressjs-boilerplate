"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountInformationSchema = void 0;
// src/modules/users/validations/account-information.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
exports.accountInformationSchema = joi_1.default.object({
    first_name: joi_1.default.string().min(1).max(100).required(),
    middle_name: joi_1.default.string().min(1).max(100).allow(null, ""),
    last_name: joi_1.default.string().min(1).max(100).required(),
    address: joi_1.default.string().min(10).max(255).allow(null, ""),
});
