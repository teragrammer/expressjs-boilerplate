"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/shared/validations/database/exists.spec.ts
const vitest_1 = require("vitest");
const joi_1 = __importDefault(require("joi"));
const exists_1 = require("./exists");
(0, vitest_1.describe)('validateExists validation', () => {
    // Create a lightweight mock of the Kysely executor using Vitest's vi.fn()
    const createMockDb = (row) => {
        const builder = {
            select: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            executeTakeFirst: vitest_1.vi.fn().mockResolvedValue(row)
        };
        return {
            selectFrom: vitest_1.vi.fn().mockReturnValue(builder),
            __builder: builder
        };
    };
    (0, vitest_1.it)('should pass validation when record exists', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDb = createMockDb({ one: 1 });
        const schema = joi_1.default.number().external((0, exists_1.validateExists)('users', { db: mockDb }));
        yield (0, vitest_1.expect)(schema.validateAsync(1)).resolves.toBe(1);
        (0, vitest_1.expect)(mockDb.selectFrom).toHaveBeenCalledWith('users');
        (0, vitest_1.expect)(mockDb.__builder.where).toHaveBeenCalledWith('id', '=', 1);
    }));
    (0, vitest_1.it)('should fail validation and throw Joi error when record does not exist', () => __awaiter(void 0, void 0, void 0, function* () {
        const mockDb = createMockDb(undefined);
        const schema = joi_1.default.number().external((0, exists_1.validateExists)('users', { db: mockDb }));
        yield (0, vitest_1.expect)(schema.validateAsync(999)).rejects.toThrow(joi_1.default.ValidationError);
    }));
});
