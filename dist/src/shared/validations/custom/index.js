"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.phoneExtension = void 0;
const phone_1 = require("./phone");
const phoneExtension = (joi) => ({
    type: 'string',
    base: joi.string(),
    messages: {
        'string.phone': '{{#label}} must be a valid phone number',
    },
    rules: {
        phone: {
            validate(value, helpers) {
                const result = (0, phone_1.phoneValidator)(value, helpers);
                // If the validator returned an error helper object, intercept and swap the message code
                if (result && typeof result === 'object' && 'local' in result) {
                    return helpers.error('string.phone');
                }
                return result;
            }
        }
    }
});
exports.phoneExtension = phoneExtension;
