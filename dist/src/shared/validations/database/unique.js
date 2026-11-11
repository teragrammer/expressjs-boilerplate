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
exports.validateCompositeUnique = exports.validateUnique = void 0;
// src/shared/validations/database/unique.ts
const joi_1 = __importDefault(require("joi"));
const kysely_1 = require("kysely");
const database_1 = require("../../../config/database");
const logger_1 = require("../../../config/logger");
/**
 * Validates uniqueness for a **scalar** field (single column).
 * When attached via Joi's `.external()`, Joi passes the scalar value directly.
 */
const validateUnique = (table, column, { ignoreId, idColumn = 'id', db = database_1.db } = {}) => {
    const validIdentifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!validIdentifierRegex.test(table) || !validIdentifierRegex.test(column) || !validIdentifierRegex.test(idColumn)) {
        throw new Error(`Security Exception: Invalid characters in table, column, or identity identifier structures.`);
    }
    return (value, helpers) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        // Handle null/empty per schema's allow(null, "") - skip uniqueness check
        if (value === null || value === undefined || value === '') {
            return value;
        }
        let row;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let query = db.selectFrom(table).select((0, kysely_1.sql) `1`.as('one'));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            query = query.where(column, '=', value);
            if (ignoreId !== undefined && ignoreId !== null) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query = query.where(idColumn, '<>', ignoreId);
            }
            row = yield query.executeTakeFirst();
        }
        catch (error) {
            logger_1.logger.error({ table, column, message: error.message }, "Database unique validation error");
            throw new joi_1.default.ValidationError('database.error', [
                {
                    message: 'An internal validation error occurred.',
                    path: (_a = helpers.state.path) !== null && _a !== void 0 ? _a : [],
                    type: 'database.error',
                    context: { key: column }
                }
            ], value);
        }
        if (row) {
            throw new joi_1.default.ValidationError('any.unique', [
                {
                    message: `${column} already exists.`,
                    path: helpers.state.path && helpers.state.path.length > 0 ? helpers.state.path : [column],
                    type: 'any.unique',
                    context: { key: column, value }
                }
            ], value);
        }
        return value;
    });
};
exports.validateUnique = validateUnique;
/**
 * Validates uniqueness for **composite** fields (multiple columns).
 * When attached via Joi's `.external()` on an object schema, Joi passes the full object.
 */
const validateCompositeUnique = (table, columns, { ignoreId, idColumn = 'id', db = database_1.db } = {}) => {
    const validIdentifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!validIdentifierRegex.test(table) || !validIdentifierRegex.test(idColumn) || !columns.every(col => validIdentifierRegex.test(col))) {
        throw new Error(`Security Exception: Invalid characters in table, column, or identity identifier structures.`);
    }
    return (value, helpers) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        if (!value) {
            return value;
        }
        let row;
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let query = db.selectFrom(table).select((0, kysely_1.sql) `1`.as('one'));
            columns.forEach((col) => {
                const fieldValue = value[col];
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query = query.where(col, '=', fieldValue !== undefined ? fieldValue : null);
            });
            if (ignoreId !== undefined && ignoreId !== null) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                query = query.where(idColumn, '<>', ignoreId);
            }
            row = yield query.executeTakeFirst();
        }
        catch (error) {
            logger_1.logger.error({ table, columns, message: error.message }, "Database unique validation error");
            throw new joi_1.default.ValidationError('database.error', [
                {
                    message: 'An internal validation error occurred.',
                    path: (_a = helpers.state.path) !== null && _a !== void 0 ? _a : [],
                    type: 'database.error',
                    context: { key: columns.join('_') }
                }
            ], value);
        }
        if (row) {
            throw new joi_1.default.ValidationError('any.unique', [
                {
                    message: `The combination of fields (${columns.join(', ')}) already exists.`,
                    path: helpers.state.path && helpers.state.path.length > 0 ? helpers.state.path : columns,
                    type: 'any.unique',
                    context: { key: columns.join('_'), value }
                }
            ], value);
        }
        return value;
    });
};
exports.validateCompositeUnique = validateCompositeUnique;
