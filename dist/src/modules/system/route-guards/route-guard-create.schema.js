"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.routeGuardCreateSchema = void 0;
// src/modules/system/route-guards/route-guard-create.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const exists_1 = require("../../../shared/validations/database/exists");
const route_guard_catalog_1 = require("./route-guard.catalog");
exports.routeGuardCreateSchema = joi_1.default.object({
    role_id: joi_1.default.number().integer().required()
        .external((0, exists_1.validateExists)("roles", { column: "id" })),
    route: joi_1.default.string().min(3).max(100).required()
        .custom((value, helpers) => {
        try {
            return (0, route_guard_catalog_1.normalizeRoute)(value);
        }
        catch (error) {
            return helpers.error("any.invalid");
        }
    })
        .messages({
        "any.invalid": "The route must use the 'resource:action' format, for example 'users:create'.",
    }),
});
