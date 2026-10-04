// src/shared/validations/database/exists.ts
import Joi from 'joi';
import {sql} from 'kysely';
import {db as defaultDb, type DatabaseExecutor} from '../../../config/database';

interface ExistsOptions {
    column?: string;
    db?: DatabaseExecutor;
}

export const validateExists = (
    table: string,
    {column = 'id', db = defaultDb}: ExistsOptions = {}
) => {
    const validIdentifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!validIdentifierRegex.test(table) || !validIdentifierRegex.test(column)) {
        throw new Error(`Security Exception: Invalid characters in table "${table}" or column "${column}" names.`);
    }

    return async (value: any, helpers: Joi.CustomHelpers): Promise<any> => {
        if (value === undefined || value === null) return value;

        let row: unknown;

        // 1. ONLY wrap the database operation in try/catch
        try {
            // Table/column identifiers are allowlisted above; the value
            // stays parameterized through the query builder.
            row = await db
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .selectFrom(table as any)
                .select(sql`1`.as('one'))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .where(column as any, '=', value)
                .executeTakeFirst();
        } catch (error) {
            console.error(`Database validation error on ${table}.${column}:`, error);

            throw new Joi.ValidationError(
                'database.error',
                [
                    {
                        message: 'An internal validation error occurred.',
                        path: helpers.state.path ?? [],
                        type: 'database.error',
                        context: {key: helpers.state.path?.join('.') ?? ''}
                    }
                ],
                value
            );
        }

        // 2. Throw the validation error OUTSIDE the try/catch block
        if (!row) {
            throw new Joi.ValidationError(
                'any.exists',
                [
                    {
                        message: `The referenced record with ${column} does not exist.`,
                        path: helpers.state.path ?? [],
                        type: 'any.exists',
                        context: {
                            key: helpers.state.path?.join('.') ?? '',
                            value,
                            table
                        }
                    }
                ],
                value
            );
        }

        return value;
    };
};
