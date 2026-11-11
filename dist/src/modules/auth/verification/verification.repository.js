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
exports.VerificationRepository = exports.VERIFICATION_TOKEN_TABLE = void 0;
// src/modules/auth/verification/verification.repository.ts
const kysely_1 = require("kysely");
const database_1 = require("../../../config/database");
exports.VERIFICATION_TOKEN_TABLE = "verification_tokens";
class VerificationRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    create(data_1) {
        return __awaiter(this, arguments, void 0, function* (data, executor = this.db) {
            return executor
                .insertInto(exports.VERIFICATION_TOKEN_TABLE)
                .values({
                user_id: data.user_id,
                channel: data.channel,
                target: data.target,
                token_hash: data.token_hash,
                expires_at: data.expires_at,
            })
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }
    findByHash(tokenHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.VERIFICATION_TOKEN_TABLE)
                .selectAll()
                .where("token_hash", "=", tokenHash)
                .executeTakeFirst();
            return row !== null && row !== void 0 ? row : null;
        });
    }
    /**
     * Invalidates every pending token for a user/channel pair.
     *
     * Called when a new token is issued or the target changes, so a
     * stale token can never be redeemed.
     */
    invalidateForUserChannel(userId_1, channel_1) {
        return __awaiter(this, arguments, void 0, function* (userId, channel, executor = this.db) {
            const result = yield executor
                .updateTable(exports.VERIFICATION_TOKEN_TABLE)
                .set({
                consumed_at: new Date(),
                updated_at: new Date(),
            })
                .where("user_id", "=", userId)
                .where("channel", "=", channel)
                .where("consumed_at", "is", null)
                .executeTakeFirst();
            return Number(result.numUpdatedRows);
        });
    }
    incrementAttempts(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.VERIFICATION_TOKEN_TABLE)
                .set({
                attempts: (0, kysely_1.sql) `attempts + 1`,
                updated_at: new Date(),
            })
                .where("id", "=", id)
                .execute();
        });
    }
    consume(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.VERIFICATION_TOKEN_TABLE)
                .set({
                consumed_at: new Date(),
                updated_at: new Date(),
            })
                .where("id", "=", id)
                .execute();
        });
    }
    /**
     * Checks whether a target is already verified for a user.
     */
    isTargetVerified(userId, channel, target) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.VERIFICATION_TOKEN_TABLE)
                .select("id")
                .where("user_id", "=", userId)
                .where("channel", "=", channel)
                .where("target", "=", target)
                .where("consumed_at", "is not", null)
                .where("expires_at", ">", (0, kysely_1.sql) `now()`)
                .executeTakeFirst();
            return Boolean(row);
        });
    }
}
exports.VerificationRepository = VerificationRepository;
