"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const phone_1 = require("./phone");
(0, vitest_1.describe)('phoneValidator()', () => {
    const mockHelpers = {
        error: (msg) => ({ errorType: msg }),
    };
    (0, vitest_1.it)('should return the original value if it is null or undefined', () => {
        (0, vitest_1.expect)((0, phone_1.phoneValidator)(null, mockHelpers)).toBeNull();
        (0, vitest_1.expect)((0, phone_1.phoneValidator)(undefined, mockHelpers)).toBeUndefined();
    });
    (0, vitest_1.it)('should return the value if it is a valid international phone number', () => {
        const validUS = '+14155552671';
        (0, vitest_1.expect)((0, phone_1.phoneValidator)(validUS, mockHelpers)).toBe(validUS);
    });
    (0, vitest_1.it)('should return a Joi error helper if the format is fundamentally wrong', () => {
        const invalidInput = 'not-a-phone-number';
        const result = (0, phone_1.phoneValidator)(invalidInput, mockHelpers);
        (0, vitest_1.expect)(result).toHaveProperty('errorType', 'any.invalid');
    });
    (0, vitest_1.it)('should handle invalid country codes safely and return an error helper', () => {
        const invalidCountry = '+9991234567';
        const result = (0, phone_1.phoneValidator)(invalidCountry, mockHelpers);
        (0, vitest_1.expect)(result).toHaveProperty('errorType', 'any.invalid');
    });
});
