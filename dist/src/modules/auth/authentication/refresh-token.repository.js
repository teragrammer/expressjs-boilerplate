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
exports.RefreshTokenRepository = exports.REFRESH_TOKEN_TABLE = void 0;
// src/modules/auth/authentication/refresh-token.repository.ts
const kysely_1 = require("kysely");
const database_1 = require("../../../config/database");
exports.REFRESH_TOKEN_TABLE = "refresh_tokens";
class RefreshTokenRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            return this.db
                .insertInto(exports.REFRESH_TOKEN_TABLE)
                .values({
                session_id: data.session_id,
                user_id: data.user_id,
                token_hash: data.token_hash,
                family_id: data.family_id,
                expires_at: data.expires_at,
                ip: (_a = data.ip) !== null && _a !== void 0 ? _a : null,
                user_agent: (_b = data.user_agent) !== null && _b !== void 0 ? _b : null,
            })
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }
    /**
     * Finds a refresh token by its stored hash.
     */
    findByHash(tokenHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.REFRESH_TOKEN_TABLE)
                .selectAll()
                .where("token_hash", "=", tokenHash)
                .executeTakeFirst();
            return row !== null && row !== void 0 ? row : null;
        });
    }
    /**
     * Marks a token as used: revoked and replaced by its successor.
     */
    revoke(id, replacedBy) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.REFRESH_TOKEN_TABLE)
                .set({
                revoked_at: new Date(),
                replaced_by: replacedBy,
                updated_at: new Date(),
            })
                .where("id", "=", id)
                .execute();
        });
    }
    /**
     * Revokes every token in a family.
     *
     * Used when reuse is detected: presenting an already-used refresh
     * token means the family is compromised and must be invalidated.
     */
    revokeFamily(familyId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .updateTable(exports.REFRESH_TOKEN_TABLE)
                .set({
                revoked_at: (0, kysely_1.sql) `COALESCE(revoked_at, now())`,
                updated_at: new Date(),
            })
                .where("family_id", "=", familyId)
                .where("revoked_at", "is", null)
                .executeTakeFirst();
            return Number(result.numUpdatedRows);
        });
    }
    /**
     * Revokes every refresh token for a session.
     */
    revokeBySessionId(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .updateTable(exports.REFRESH_TOKEN_TABLE)
                .set({
                revoked_at: (0, kysely_1.sql) `COALESCE(revoked_at, now())`,
                updated_at: new Date(),
            })
                .where("session_id", "=", sessionId)
                .where("revoked_at", "is", null)
                .executeTakeFirst();
            return Number(result.numUpdatedRows);
        });
    }
    /**
     * Revokes every refresh token for a user.
     */
    revokeAllByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .updateTable(exports.REFRESH_TOKEN_TABLE)
                .set({
                revoked_at: (0, kysely_1.sql) `COALESCE(revoked_at, now())`,
                updated_at: new Date(),
            })
                .where("user_id", "=", userId)
                .where("revoked_at", "is", null)
                .executeTakeFirst();
            return Number(result.numUpdatedRows);
        });
    }
    /**
     * Lists the active refresh tokens (sessions) of a user.
     */
    findActiveByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.db
                .selectFrom(exports.REFRESH_TOKEN_TABLE)
                .selectAll()
                .where("user_id", "=", userId)
                .where("revoked_at", "is", null)
                .where("expires_at", ">", (0, kysely_1.sql) `now()`)
                .orderBy("created_at", "desc")
                .execute();
        });
    }
    /**
     * Removes expired and already-revoked rows.
     */
    purgeExpired() {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.REFRESH_TOKEN_TABLE)
                .where("expires_at", "<", (0, kysely_1.sql) `now()`)
                .executeTakeFirst();
            return Number(result.numDeletedRows);
        });
    }
}
exports.RefreshTokenRepository = RefreshTokenRepository;
