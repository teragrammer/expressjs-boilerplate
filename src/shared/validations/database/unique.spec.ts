// __test__/shared/validations/database/unique.spec.ts
import {beforeEach, describe, expect, it, vi} from 'vitest';
import Joi from 'joi';
import {validateCompositeUnique} from "./unique";

describe('validateCompositeUnique validation', () => {
    let mockBuilder: any;
    let mockDb: any;

    beforeEach(() => {
        // Construct a chainable query builder mock object
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
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined); // Record doesn't exist yet -> Unique!

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
        mockBuilder.executeTakeFirst.mockResolvedValue({one: 1}); // Row found! -> Conflict!

        const schema = Joi.object({
            user_id: Joi.number().required(),
            organization_id: Joi.number().required()
        }).external(validateCompositeUnique('memberships', ['user_id', 'organization_id'], {db: mockDb}));

        const input = {user_id: 1, organization_id: 10};
        await expect(schema.validateAsync(input)).rejects.toThrow(Joi.ValidationError);
    });

    it('should bypass the matching collision when ignoreId condition matches', async () => {
        mockBuilder.executeTakeFirst.mockResolvedValue(undefined); // Found nothing because the id was excluded

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
});
