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
exports.validateExists = void 0;
// src/shared/validations/database/exists.ts
const joi_1 = __importDefault(require("joi"));
const kysely_1 = require("kysely");
const database_1 = require("../../../config/database");
const logger_1 = require("../../../config/logger");
const validateExists = (table, { column = 'id', db = database_1.db } = {}) => {
    const validIdentifierRegex = /^[a-zA-Z0-9_]+$/;
    if (!validIdentifierRegex.test(table) || !validIdentifierRegex.test(column)) {
        throw new Error(`Security Exception: Invalid characters in table "${table}" or column "${column}" names.`);
    }
    return (value, helpers) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f;
        if (value === undefined || value === null) {
            return value;
        }
        let row;
        // 1. ONLY wrap the database operation in try/catch
        try {
            // Table/column identifiers are allowlisted above; the value
            // stays parameterized through the query builder.
            row = yield db
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .selectFrom(table)
                .select((0, kysely_1.sql) `1`.as('one'))
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .where(column, '=', value)
                .executeTakeFirst();
        }
        catch (error) {
            logger_1.logger.error({ table, column, message: error.message }, "Database validation error");
            throw new joi_1.default.ValidationError('database.error', [
                {
                    message: 'An internal validation error occurred.',
                    path: (_a = helpers.state.path) !== null && _a !== void 0 ? _a : [],
                    type: 'database.error',
                    context: { key: (_c = (_b = helpers.state.path) === null || _b === void 0 ? void 0 : _b.join('.')) !== null && _c !== void 0 ? _c : '' }
                }
            ], value);
        }
        // 2. Throw the validation error OUTSIDE the try/catch block
        if (!row) {
            throw new joi_1.default.ValidationError('any.exists', [
                {
                    message: `The referenced record with ${column} does not exist.`,
                    path: (_d = helpers.state.path) !== null && _d !== void 0 ? _d : [],
                    type: 'any.exists',
                    context: {
                        key: (_f = (_e = helpers.state.path) === null || _e === void 0 ? void 0 : _e.join('.')) !== null && _f !== void 0 ? _f : '',
                        value,
                        table
                    }
                }
            ], value);
        }
        return value;
    });
};
exports.validateExists = validateExists;
