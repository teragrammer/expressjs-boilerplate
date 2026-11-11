"use strict";
// src/shared/validations/joi.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Joi = void 0;
const joi_1 = __importDefault(require("joi"));
const custom_1 = require("./custom");
// Extend the actual runtime Joi instance
const Joi = joi_1.default.extend(custom_1.phoneExtension);
exports.Joi = Joi;
exports.default = Joi;
