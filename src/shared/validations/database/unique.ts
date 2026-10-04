// src/shared/validations/database/unique.ts
import Joi from 'joi';
import {sql} from 'kysely';
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";

interface CompositeUniqueOptions {
    ignoreId?: string | number;
    idColumn?: string;
    db?: DatabaseExecutor;
}

export const validateCompositeUnique = (
    table: string,
    columns: string[],
    {ignoreId, idColumn = 'id', db = defaultDb}: CompositeUniqueOptions = {}
) => {
    const validIdentifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!validIdentifierRegex.test(table) || !validIdentifierRegex.test(idColumn) || !columns.every(col => validIdentifierRegex.test(col))) {
        throw new Error(`Security Exception: Invalid characters in table, column, or identity identifier structures.`);
    }

    return async (value: Record<string, any>, helpers: Joi.CustomHelpers): Promise<Record<string, any>> => {
        if (!value) return value;

        let row: unknown;

        // 1. ONLY wrap the database operation in try/catch
        try {
            // Table/column identifiers are allowlisted above; values stay
            // parameterized through the query builder.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let query = db.selectFrom(table as any).select(sql`1`.as('one'));

            columns.forEach((col) => {
                const fieldValue = value[col];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query = query.where(col as any, '=', fieldValue !== undefined ? fieldValue : null);
            });

            if (ignoreId !== undefined && ignoreId !== null) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query = query.where(idColumn as any, '<>', ignoreId);
            }

            row = await query.executeTakeFirst();
        } catch (error) {
            console.error(`Database unique validation error on ${table} [${columns.join(', ')}]:`, error);

            throw new Joi.ValidationError(
                'database.error',
                [
                    {
                        message: 'An internal validation error occurred.',
                        path: helpers.state.path ?? [],
                        type: 'database.error',
                        context: {key: columns.join('_')}
                    }
                ],
                value
            );
        }

        // 2. Throw the validation error OUTSIDE the try/catch block
        if (row) {
            throw new Joi.ValidationError(
                'any.unique',
                [
                    {
                        message: `The combination of fields (${columns.join(', ')}) already exists.`,
                        path: helpers.state.path && helpers.state.path.length > 0 ? helpers.state.path : columns,
                        type: 'any.unique',
                        context: {key: columns.join('_'), value}
                    }
                ],
                value
            );
        }

        return value;
    };
};
