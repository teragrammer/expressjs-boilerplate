"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingUpdateSchema = void 0;
// src/modules/users/validations/user-update.schema.ts
const joi_1 = __importDefault(require("../../../shared/validations/joi"));
const unique_1 = require("../../../shared/validations/database/unique");
const setting_model_1 = require("./setting.model");
const settingUpdateSchema = (settingId) => joi_1.default.object({
    name: joi_1.default.string().min(1).max(50).required(),
    slug: joi_1.default.string().min(1).max(50).required()
        .external((0, unique_1.validateCompositeUnique)("settings", ["slug"], { ignoreId: settingId })),
    value: joi_1.default.any(),
    description: joi_1.default.string().min(1).max(200),
    type: joi_1.default.string().valid(...setting_model_1.DATA_TYPES).required(),
    is_disabled: joi_1.default.number().valid(0, 1).required(),
    is_public: joi_1.default.number().valid(0, 1).required(),
});
exports.settingUpdateSchema = settingUpdateSchema;
