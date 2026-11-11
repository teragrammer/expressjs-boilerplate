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
// __test__/shared/validations/database/unique.spec.ts
const vitest_1 = require("vitest");
const joi_1 = __importDefault(require("joi"));
const unique_1 = require("./unique");
(0, vitest_1.describe)('validateUnique (scalar) validation', () => {
    let mockBuilder;
    let mockDb;
    (0, vitest_1.beforeEach)(() => {
        mockBuilder = {
            select: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            executeTakeFirst: vitest_1.vi.fn()
        };
        mockDb = {
            selectFrom: vitest_1.vi.fn().mockReturnValue(mockBuilder)
        };
    });
    (0, vitest_1.it)('should pass validation when no matching record exists', () => __awaiter(void 0, void 0, void 0, function* () {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);
        const schema = joi_1.default.string().external((0, unique_1.validateUnique)('users', 'email', { db: mockDb }));
        yield (0, vitest_1.expect)(schema.validateAsync('new@example.com')).resolves.toBe('new@example.com');
        (0, vitest_1.expect)(mockDb.selectFrom).toHaveBeenCalledWith('users');
        (0, vitest_1.expect)(mockBuilder.where).toHaveBeenCalledWith('email', '=', 'new@example.com');
    }));
    (0, vitest_1.it)('should fail validation when a matching record exists', () => __awaiter(void 0, void 0, void 0, function* () {
        mockBuilder.executeTakeFirst.mockResolvedValue({ one: 1 });
        const schema = joi_1.default.string().external((0, unique_1.validateUnique)('users', 'email', { db: mockDb }));
        yield (0, vitest_1.expect)(schema.validateAsync('existing@example.com')).rejects.toThrow(joi_1.default.ValidationError);
    }));
    (0, vitest_1.it)('should bypass the matching collision when ignoreId condition matches', () => __awaiter(void 0, void 0, void 0, function* () {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);
        const schema = joi_1.default.string().external((0, unique_1.validateUnique)('users', 'email', {
            db: mockDb,
            ignoreId: 5,
            idColumn: 'id'
        }));
        yield (0, vitest_1.expect)(schema.validateAsync('existing@example.com')).resolves.toBe('existing@example.com');
        (0, vitest_1.expect)(mockBuilder.where).toHaveBeenCalledWith('id', '<>', 5);
    }));
    (0, vitest_1.it)('should skip validation for null, undefined, or empty string', () => __awaiter(void 0, void 0, void 0, function* () {
        const schema = joi_1.default.string().allow(null, '').external((0, unique_1.validateUnique)('users', 'email', { db: mockDb }));
        yield (0, vitest_1.expect)(schema.validateAsync(null)).resolves.toBeNull();
        yield (0, vitest_1.expect)(schema.validateAsync('')).resolves.toBe('');
        yield (0, vitest_1.expect)(schema.validateAsync(undefined)).resolves.toBeUndefined();
        (0, vitest_1.expect)(mockDb.selectFrom).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)('should throw on invalid table/column identifiers', () => {
        (0, vitest_1.expect)(() => (0, unique_1.validateUnique)('users;--', 'email')).toThrow('Security Exception');
        (0, vitest_1.expect)(() => (0, unique_1.validateUnique)('users', 'email;--')).toThrow('Security Exception');
    });
});
(0, vitest_1.describe)('validateCompositeUnique validation', () => {
    let mockBuilder;
    let mockDb;
    (0, vitest_1.beforeEach)(() => {
        mockBuilder = {
            select: vitest_1.vi.fn().mockReturnThis(),
            where: vitest_1.vi.fn().mockReturnThis(),
            executeTakeFirst: vitest_1.vi.fn()
        };
        mockDb = {
            selectFrom: vitest_1.vi.fn().mockReturnValue(mockBuilder)
        };
    });
    (0, vitest_1.it)('should pass validation when no matching record exists', () => __awaiter(void 0, void 0, void 0, function* () {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);
        const schema = joi_1.default.object({
            user_id: joi_1.default.number().required(),
            organization_id: joi_1.default.number().required()
        }).external((0, unique_1.validateCompositeUnique)('memberships', ['user_id', 'organization_id'], { db: mockDb }));
        const input = { user_id: 1, organization_id: 10 };
        yield (0, vitest_1.expect)(schema.validateAsync(input)).resolves.toEqual(input);
        (0, vitest_1.expect)(mockDb.selectFrom).toHaveBeenCalledWith('memberships');
        (0, vitest_1.expect)(mockBuilder.where).toHaveBeenCalledWith('user_id', '=', 1);
        (0, vitest_1.expect)(mockBuilder.where).toHaveBeenCalledWith('organization_id', '=', 10);
    }));
    (0, vitest_1.it)('should fail validation when a matching record exists', () => __awaiter(void 0, void 0, void 0, function* () {
        mockBuilder.executeTakeFirst.mockResolvedValue({ one: 1 });
        const schema = joi_1.default.object({
            user_id: joi_1.default.number().required(),
            organization_id: joi_1.default.number().required()
        }).external((0, unique_1.validateCompositeUnique)('memberships', ['user_id', 'organization_id'], { db: mockDb }));
        const input = { user_id: 1, organization_id: 10 };
        yield (0, vitest_1.expect)(schema.validateAsync(input)).rejects.toThrow(joi_1.default.ValidationError);
    }));
    (0, vitest_1.it)('should bypass the matching collision when ignoreId condition matches', () => __awaiter(void 0, void 0, void 0, function* () {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);
        const schema = joi_1.default.object({
            user_id: joi_1.default.number().required(),
            organization_id: joi_1.default.number().required()
        }).external((0, unique_1.validateCompositeUnique)('memberships', ['user_id', 'organization_id'], {
            db: mockDb,
            ignoreId: 5,
            idColumn: 'id'
        }));
        const input = { user_id: 1, organization_id: 10 };
        yield (0, vitest_1.expect)(schema.validateAsync(input)).resolves.toEqual(input);
        (0, vitest_1.expect)(mockBuilder.where).toHaveBeenCalledWith('id', '<>', 5);
    }));
    (0, vitest_1.it)('should throw on invalid table/column identifiers', () => {
        (0, vitest_1.expect)(() => (0, unique_1.validateCompositeUnique)('memberships;--', ['user_id'])).toThrow('Security Exception');
        (0, vitest_1.expect)(() => (0, unique_1.validateCompositeUnique)('memberships', ['user_id;--'])).toThrow('Security Exception');
    });
});
