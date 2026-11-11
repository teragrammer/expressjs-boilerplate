// src/shared/validations/database/unique.ts
import Joi from 'joi';
import {sql} from 'kysely';
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import {logger} from "../../../config/logger";

interface UniqueOptions {
    ignoreId?: string | number;
    idColumn?: string;
    db?: DatabaseExecutor;
}

/**
 * Validates uniqueness for a **scalar** field (single column).
 * When attached via Joi's `.external()`, Joi passes the scalar value directly.
 */
export const validateUnique = (
    table: string,
    column: string,
    {ignoreId, idColumn = 'id', db = defaultDb}: UniqueOptions = {}
) => {
    const validIdentifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!validIdentifierRegex.test(table) || !validIdentifierRegex.test(column) || !validIdentifierRegex.test(idColumn)) {
        throw new Error(`Security Exception: Invalid characters in table, column, or identity identifier structures.`);
    }

    return async (value: any, helpers: Joi.CustomHelpers): Promise<any> => {
        // Handle null/empty per schema's allow(null, "") - skip uniqueness check
        if (value === null || value === undefined || value === '') {
            return value;
        }

        let row: unknown;

        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let query = db.selectFrom(table as any).select(sql`1`.as('one'));

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query = query.where(column as any, '=', value);

            if (ignoreId !== undefined && ignoreId !== null) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query = query.where(idColumn as any, '<>', ignoreId);
            }

            row = await query.executeTakeFirst();
        } catch (error) {
            logger.error(
                    {table, column, message: (error as Error).message},
                    "Database unique validation error",
                );

            throw new Joi.ValidationError(
                'database.error',
                [
                    {
                        message: 'An internal validation error occurred.',
                        path: helpers.state.path ?? [],
                        type: 'database.error',
                        context: {key: column}
                    }
                ],
                value
            );
        }

        if (row) {
            throw new Joi.ValidationError(
                'any.unique',
                [
                    {
                        message: `${column} already exists.`,
                        path: helpers.state.path && helpers.state.path.length > 0 ? helpers.state.path : [column],
                        type: 'any.unique',
                        context: {key: column, value}
                    }
                ],
                value
            );
        }

        return value;
    };
};

interface CompositeUniqueOptions {
    ignoreId?: string | number;
    idColumn?: string;
    db?: DatabaseExecutor;
}

/**
 * Validates uniqueness for **composite** fields (multiple columns).
 * When attached via Joi's `.external()` on an object schema, Joi passes the full object.
 */
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
        if (!value) {return value;}

        let row: unknown;

        try {
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
            logger.error(
                    {table, columns, message: (error as Error).message},
                    "Database unique validation error",
                );

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
