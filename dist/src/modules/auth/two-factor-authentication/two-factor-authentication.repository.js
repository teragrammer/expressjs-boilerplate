"use strict";
// src/modules/auth/two-factor-authentication/two-factor-authentication.repository.ts
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
exports.TwoFactorAuthenticationRepository = exports.TWO_FACTOR_AUTHENTICATION_TABLE = void 0;
const kysely_1 = require("kysely");
const database_1 = require("../../../config/database");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
exports.TWO_FACTOR_AUTHENTICATION_TABLE = "two_factor_authentications";
class TwoFactorAuthenticationRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    findByTokenId(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .selectFrom(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                .selectAll()
                .where("token_id", "=", tokenId)
                .executeTakeFirst();
            return result || null;
        });
    }
    /**
     * Atomically issues or refreshes an OTP.
     *
     * The transaction + row lock prevents two concurrent requests
     * from refreshing the same existing OTP at the same time.
     *
     * The unique token_id constraint handles the special case where
     * two concurrent requests attempt to create the first OTP row.
     */
    issueOtp(tokenId, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!("transaction" in this.db)) {
                throw new Error("issueOtp requires the shared database instance, not a transaction.");
            }
            return this.db.transaction().execute((trx) => __awaiter(this, void 0, void 0, function* () {
                const findExisting = () => trx
                    .selectFrom(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                    .selectAll()
                    .where("token_id", "=", tokenId)
                    .forUpdate()
                    .executeTakeFirst();
                let existing = yield findExisting();
                /*
                 * First OTP for this token.
                 *
                 * FOR UPDATE cannot lock a row that doesn't exist, so
                 * two concurrent requests can both reach INSERT.
                 *
                 * The UNIQUE(token_id) constraint guarantees that only
                 * one request can actually create the row.
                 */
                if (!existing) {
                    try {
                        return yield trx
                            .insertInto(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                            .values({
                            token_id: tokenId,
                            code: data.code,
                            tries: 0,
                            expired_at: data.expired_at,
                            next_send_at: data.next_send_at,
                            created_at: data.created_at,
                        })
                            .returningAll()
                            .executeTakeFirstOrThrow();
                    }
                    catch (error) {
                        /*
                         * PostgreSQL unique violation.
                         *
                         * Another request won the race and inserted
                         * the OTP row first.
                         */
                        if (!this.isUniqueViolation(error)) {
                            throw error;
                        }
                        /*
                         * Re-read the row and acquire the row lock.
                         */
                        existing = yield findExisting();
                        if (!existing) {
                            throw error;
                        }
                    }
                }
                /*
                 * Existing OTP.
                 *
                 * Because the row is locked with FOR UPDATE, another
                 * transaction cannot modify it until this transaction
                 * finishes.
                 */
                if (existing.next_send_at &&
                    new Date(existing.next_send_at) > new Date()) {
                    throw new errors_1.AppError(messages_1.default.RESEND_OTP_NOT_POSSIBLE);
                }
                return trx
                    .updateTable(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                    .set({
                    code: data.code,
                    expired_at: data.expired_at,
                    next_send_at: data.next_send_at,
                    updated_at: (0, kysely_1.sql) `now()`,
                })
                    .where("id", "=", existing.id)
                    .returningAll()
                    .executeTakeFirstOrThrow();
            }));
        });
    }
    /**
     * PostgreSQL unique-constraint violation.
     */
    isUniqueViolation(error) {
        return (typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === "23505");
    }
    /**
     * Increments invalid OTP attempts atomically.
     */
    incrementTries(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                .set({
                tries: (0, kysely_1.sql) `tries + 1`,
                updated_at: (0, kysely_1.sql) `now()`,
            })
                .where("id", "=", id)
                .execute();
        });
    }
    /**
     * Resets rate limits once lockout expires.
     */
    resetTries(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                .set({
                tries: 0,
                expired_tries_at: null,
                updated_at: (0, kysely_1.sql) `now()`,
            })
                .where("id", "=", id)
                .execute();
        });
    }
    /**
     * Sets the lockout expiration time for OTP attempts.
     */
    setExpiredTriesAt(id, expiredAt) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                .set({
                expired_tries_at: expiredAt,
                updated_at: (0, kysely_1.sql) `now()`,
            })
                .where("id", "=", id)
                .execute();
        });
    }
    /**
     * Consumes the OTP after successful verification.
     */
    deleteById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.TWO_FACTOR_AUTHENTICATION_TABLE)
                .where("id", "=", id)
                .executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
}
exports.TwoFactorAuthenticationRepository = TwoFactorAuthenticationRepository;
