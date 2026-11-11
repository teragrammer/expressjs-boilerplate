"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/common/utils/messages.spec.ts
const vitest_1 = require("vitest");
const messages_1 = __importDefault(require("./messages"));
(0, vitest_1.describe)("Messages Dictionary", () => {
    (0, vitest_1.it)("should be frozen at runtime to ensure immutability", () => {
        (0, vitest_1.expect)(Object.isFrozen(messages_1.default)).toBe(true);
        // Ensure nested objects are also frozen if strict immutability is desired
        for (const value of Object.values(messages_1.default)) {
            (0, vitest_1.expect)(Object.isFrozen(value)).toBe(true);
        }
    });
    (0, vitest_1.it)("should have matching object keys, correct error codes, and valid HTTP status codes", () => {
        for (const [key, meta] of Object.entries(messages_1.default)) {
            // 1. Key matches the internal code string
            (0, vitest_1.expect)(meta.code).toBe(key);
            // 2. Status code must be a valid HTTP error status (400-599 range)
            (0, vitest_1.expect)(typeof meta.status).toBe("number");
            (0, vitest_1.expect)(meta.status).toBeGreaterThanOrEqual(400);
            (0, vitest_1.expect)(meta.status).toBeLessThan(600);
            // 3. Message must be a non-empty string
            (0, vitest_1.expect)(typeof meta.message).toBe("string");
            (0, vitest_1.expect)(meta.message.trim().length).toBeGreaterThan(0);
        }
    });
});
