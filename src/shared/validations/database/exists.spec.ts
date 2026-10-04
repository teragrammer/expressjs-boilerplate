// src/shared/validations/database/exists.spec.ts
import {describe, expect, it, vi} from 'vitest';
import Joi from 'joi';
import {validateExists} from "./exists";

describe('validateExists validation', () => {
    // Create a lightweight mock of the Kysely executor using Vitest's vi.fn()
    const createMockDb = (row: unknown) => {
        const builder = {
            select: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            executeTakeFirst: vi.fn().mockResolvedValue(row)
        };

        return {
            selectFrom: vi.fn().mockReturnValue(builder),
            __builder: builder
        };
    };

    it('should pass validation when record exists', async () => {
        const mockDb = createMockDb({one: 1});

        const schema = Joi.number().external(
            validateExists('users', {db: mockDb as any})
        );

        await expect(schema.validateAsync(1)).resolves.toBe(1);

        expect(mockDb.selectFrom).toHaveBeenCalledWith('users');
        expect(mockDb.__builder.where).toHaveBeenCalledWith('id', '=', 1);
    });

    it('should fail validation and throw Joi error when record does not exist', async () => {
        const mockDb = createMockDb(undefined);

        const schema = Joi.number().external(
            validateExists('users', {db: mockDb as any})
        );

        await expect(schema.validateAsync(999)).rejects.toThrow(Joi.ValidationError);
    });
});
