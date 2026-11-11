// __test__/shared/validations/database/unique.spec.ts
import {beforeEach, describe, expect, it, vi} from 'vitest';
import Joi from 'joi';
import {validateUnique, validateCompositeUnique} from "./unique";

describe('validateUnique (scalar) validation', () => {
    let mockBuilder: any;
    let mockDb: any;

    beforeEach(() => {
        mockBuilder = {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn()
        };

        mockDb = {
            selectFrom: vi.fn().mockReturnValue(mockBuilder)
        };
    });

    it('should pass validation when no matching record exists', async () => {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);

        const schema = Joi.string().external(validateUnique('users', 'email', {db: mockDb}));

        await expect(schema.validateAsync('new@example.com')).resolves.toBe('new@example.com');

        expect(mockDb.selectFrom).toHaveBeenCalledWith('users');
        expect(mockBuilder.where).toHaveBeenCalledWith('email', '=', 'new@example.com');
    });

    it('should fail validation when a matching record exists', async () => {
        mockBuilder.executeTakeFirst.mockResolvedValue({one: 1});

        const schema = Joi.string().external(validateUnique('users', 'email', {db: mockDb}));

        await expect(schema.validateAsync('existing@example.com')).rejects.toThrow(Joi.ValidationError);
    });

    it('should bypass the matching collision when ignoreId condition matches', async () => {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);

        const schema = Joi.string().external(validateUnique('users', 'email', {
            db: mockDb,
            ignoreId: 5,
            idColumn: 'id'
        }));

        await expect(schema.validateAsync('existing@example.com')).resolves.toBe('existing@example.com');

        expect(mockBuilder.where).toHaveBeenCalledWith('id', '<>', 5);
    });

    it('should skip validation for null, undefined, or empty string', async () => {
        const schema = Joi.string().allow(null, '').external(validateUnique('users', 'email', {db: mockDb}));

        await expect(schema.validateAsync(null)).resolves.toBeNull();
        await expect(schema.validateAsync('')).resolves.toBe('');
        await expect(schema.validateAsync(undefined)).resolves.toBeUndefined();

        expect(mockDb.selectFrom).not.toHaveBeenCalled();
    });

    it('should throw on invalid table/column identifiers', () => {
        expect(() => validateUnique('users;--', 'email')).toThrow('Security Exception');
        expect(() => validateUnique('users', 'email;--')).toThrow('Security Exception');
    });
});

describe('validateCompositeUnique validation', () => {
    let mockBuilder: any;
    let mockDb: any;

    beforeEach(() => {
        mockBuilder = {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn()
        };

        mockDb = {
            selectFrom: vi.fn().mockReturnValue(mockBuilder)
        };
    });

    it('should pass validation when no matching record exists', async () => {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);

        const schema = Joi.object({
            user_id: Joi.number().required(),
            organization_id: Joi.number().required()
        }).external(validateCompositeUnique('memberships', ['user_id', 'organization_id'], {db: mockDb}));

        const input = {user_id: 1, organization_id: 10};
        await expect(schema.validateAsync(input)).resolves.toEqual(input);

        expect(mockDb.selectFrom).toHaveBeenCalledWith('memberships');
        expect(mockBuilder.where).toHaveBeenCalledWith('user_id', '=', 1);
        expect(mockBuilder.where).toHaveBeenCalledWith('organization_id', '=', 10);
    });

    it('should fail validation when a matching record exists', async () => {
        mockBuilder.executeTakeFirst.mockResolvedValue({one: 1});

        const schema = Joi.object({
            user_id: Joi.number().required(),
            organization_id: Joi.number().required()
        }).external(validateCompositeUnique('memberships', ['user_id', 'organization_id'], {db: mockDb}));

        const input = {user_id: 1, organization_id: 10};
        await expect(schema.validateAsync(input)).rejects.toThrow(Joi.ValidationError);
    });

    it('should bypass the matching collision when ignoreId condition matches', async () => {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined);

        const schema = Joi.object({
            user_id: Joi.number().required(),
            organization_id: Joi.number().required()
        }).external(validateCompositeUnique('memberships', ['user_id', 'organization_id'], {
            db: mockDb,
            ignoreId: 5,
            idColumn: 'id'
        }));

        const input = {user_id: 1, organization_id: 10};
        await expect(schema.validateAsync(input)).resolves.toEqual(input);

        expect(mockBuilder.where).toHaveBeenCalledWith('id', '<>', 5);
    });

    it('should throw on invalid table/column identifiers', () => {
        expect(() => validateCompositeUnique('memberships;--', ['user_id'])).toThrow('Security Exception');
        expect(() => validateCompositeUnique('memberships', ['user_id;--'])).toThrow('Security Exception');
    });
});
