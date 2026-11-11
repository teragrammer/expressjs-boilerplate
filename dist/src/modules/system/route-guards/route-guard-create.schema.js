"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeGuardCreateSchema = void 0;
// src/modules/system/route-guards/route-guard-create.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const unique_1 = require("../../../shared/validations/database/unique");
exports.routeGuardCreateSchema = joi_1.default.object({
    role_id: joi_1.default.number().integer().required()
        .external((0, unique_1.validateCompositeUnique)("roles", ["id"])),
    route: joi_1.default.string().min(3).max(100).required(),
});
