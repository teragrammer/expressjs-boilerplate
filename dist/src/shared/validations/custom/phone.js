"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneValidator = void 0;
// src/shared/validations/custom/phone.ts
const google_libphonenumber_1 = __importDefault(require("google-libphonenumber"));
const phoneUtil = google_libphonenumber_1.default.PhoneNumberUtil.getInstance();
/**
 * Pure TypeScript validator function for phone numbers
 */
const phoneValidator = (value, helpers) => {
    // Explicitly check for nullish values early
    if (value === undefined || value === null) {
        return value;
    }
    try {
        // google-libphonenumber parse expects a string, so we cast safely
        const number = phoneUtil.parse(String(value));
        if (!phoneUtil.isValidNumber(number)) {
            return helpers.error("any.invalid");
        }
        return value;
    }
    catch (error) {
        return helpers.error("any.invalid");
    }
};
exports.phoneValidator = phoneValidator;
