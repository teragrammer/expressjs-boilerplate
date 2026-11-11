"use strict";
// src/shared/validations/index.ts
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateExists = exports.validateCompositeUnique = exports.validateUnique = exports.Joi = void 0;
const joi_1 = __importDefault(require("./joi"));
exports.Joi = joi_1.default;
var unique_1 = require("./database/unique");
Object.defineProperty(exports, "validateUnique", { enumerable: true, get: function () { return unique_1.validateUnique; } });
Object.defineProperty(exports, "validateCompositeUnique", { enumerable: true, get: function () { return unique_1.validateCompositeUnique; } });
var exists_1 = require("./database/exists");
Object.defineProperty(exports, "validateExists", { enumerable: true, get: function () { return exists_1.validateExists; } });
__exportStar(require("./custom"), exports);
exports.default = joi_1.default;
