"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleCreateSchema = void 0;
// src/modules/system/roles/role-create.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const unique_1 = require("../../../shared/validations/database/unique");
exports.roleCreateSchema = joi_1.default.object({
    name: joi_1.default.string().min(1).max(50).required(),
    slug: joi_1.default.string().min(1).max(50).required()
        .external((0, unique_1.validateCompositeUnique)("roles", ["slug"])),
    description: joi_1.default.string().max(100).allow(null, ""),
    is_public: joi_1.default.number().valid(0, 1).required(),
    is_bypass_authorization: joi_1.default.number().valid(0, 1).required(),
});
