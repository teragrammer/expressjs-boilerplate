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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationTokenRepository = exports.TWO_FACTOR_AUTHENTICATION_TABLE = exports.AUTHENTICATION_TOKEN_TABLE = void 0;
// src/modules/auth/authentication/authentication-token.repository.ts
const kysely_1 = require("kysely");
const database_1 = require("../../../config/database");
exports.AUTHENTICATION_TOKEN_TABLE = "authentication_tokens";
exports.TWO_FACTOR_AUTHENTICATION_TABLE = "two_factor_authentications";
class AuthenticationTokenRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    /**
     * Persists a new authentication token record in the database.
     *
     * An optional executor allows the caller to create the session row
     * inside a surrounding transaction.
     */
    create(data_1) {
        return __awaiter(this, arguments, void 0, function* (data, executor = this.db) {
            return executor
                .insertInto(exports.AUTHENTICATION_TOKEN_TABLE)
                .values(data)
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }
    /**
     * Retrieves an active, unexpired token record by its ID.
     * Enforces session expiry and user_id matching for security.
     */
    findById(id, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = this.db
                .selectFrom(exports.AUTHENTICATION_TOKEN_TABLE)
                .selectAll()
                .where("id", "=", id)
                .where("expired_at", ">", (0, kysely_1.sql) `now()`);
            if (userId !== undefined) {
                query = query.where("user_id", "=", userId);
            }
            const token = yield query.executeTakeFirst();
            return token || null;
        });
    }
    /**
     * Finds all active (unexpired) tokens associated with a specific user.
     */
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.db
                .selectFrom(exports.AUTHENTICATION_TOKEN_TABLE)
                .selectAll()
                .where("user_id", "=", userId)
                .where("expired_at", ">", (0, kysely_1.sql) `now()`)
                .orderBy("created_at", "desc")
                .execute();
        });
    }
    /**
     * Partially updates an existing token record by its ID.
     */
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedToken = yield this.db
                .updateTable(exports.AUTHENTICATION_TOKEN_TABLE)
                .set(Object.assign(Object.assign({}, data), { updated_at: (0, kysely_1.sql) `now()` }))
                .where("id", "=", id)
                .returningAll()
                .executeTakeFirst();
            return updatedToken || null;
        });
    }
    /**
     * Atomically increments the retry count and updates the timestamp.
     */
    incrementTries(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.AUTHENTICATION_TOKEN_TABLE)
                .set({
                tries: (0, kysely_1.sql) `tries + 1`,
                updated_at: (0, kysely_1.sql) `now()`,
            })
                .where("id", "=", id)
                .execute();
        });
    }
    /**
     * Deletes a single token record by its primary ID.
     * Also deletes associated 2FA records to maintain referential integrity.
     */
    deleteById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            // First delete associated 2FA records
            yield this.db
                .deleteFrom(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                .where("token_id", "=", id)
                .execute();
            const result = yield this.db
                .deleteFrom(exports.AUTHENTICATION_TOKEN_TABLE)
                .where("id", "=", id)
                .executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
    /**
     * Revokes (deletes) all tokens linked to a specific user (including expired).
     * Also deletes associated 2FA records.
     */
    deleteAllByUserId(userId_1, excludeTokenId_1) {
        return __awaiter(this, arguments, void 0, function* (userId, excludeTokenId, executor = this.db) {
            // First delete all 2FA records for this user's tokens (excluding the excluded one)
            let tokenQuery = executor
                .selectFrom(exports.AUTHENTICATION_TOKEN_TABLE)
                .select("id")
                .where("user_id", "=", userId);
            if (excludeTokenId !== undefined) {
                tokenQuery = tokenQuery.where("id", "!=", excludeTokenId);
            }
            const tokens = yield tokenQuery.execute();
            if (tokens.length > 0) {
                const tokenIds = tokens.map(t => t.id);
                yield executor
                    .deleteFrom(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                    .where("token_id", "in", tokenIds)
                    .execute();
            }
            // Now delete the tokens
            let deleteQuery = executor
                .deleteFrom(exports.AUTHENTICATION_TOKEN_TABLE)
                .where("user_id", "=", userId);
            if (excludeTokenId !== undefined) {
                deleteQuery = deleteQuery.where("id", "!=", excludeTokenId);
            }
            const result = yield deleteQuery.executeTakeFirst();
            return Number(result.numDeletedRows);
        });
    }
    /**
     * Automatically purges obsolete or expired session tokens from the table.
     * Also deletes associated 2FA records.
     */
    purgeExpiredTokensByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            // First get expired token IDs
            const expiredTokens = yield this.db
                .selectFrom(exports.AUTHENTICATION_TOKEN_TABLE)
                .select("id")
                .where("user_id", "=", userId)
                .where("expired_at", "<", (0, kysely_1.sql) `now()`)
                .execute();
            if (expiredTokens.length > 0) {
                const tokenIds = expiredTokens.map(t => t.id);
                // Delete associated 2FA records
                yield this.db
                    .deleteFrom(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                    .where("token_id", "in", tokenIds)
                    .execute();
                // Delete expired tokens
                const result = yield this.db
                    .deleteFrom(exports.AUTHENTICATION_TOKEN_TABLE)
                    .where("id", "in", tokenIds)
                    .executeTakeFirst();
                return Number(result.numDeletedRows);
            }
            return 0;
        });
    }
}
exports.AuthenticationTokenRepository = AuthenticationTokenRepository;
