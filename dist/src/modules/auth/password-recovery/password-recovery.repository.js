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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordRecoveryRepository = exports.PASSWORD_RECOVERIES_TABLE = void 0;
const database_1 = require("../../../config/database");
exports.PASSWORD_RECOVERIES_TABLE = "password_recoveries";
class PasswordRecoveryRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    findBySendTo(sendTo, type) {
        return __awaiter(this, void 0, void 0, function* () {
            let query = this.db
                .selectFrom(exports.PASSWORD_RECOVERIES_TABLE)
                .selectAll()
                .where("send_to", "=", sendTo);
            if (type) {
                query = query.where("type", "=", type);
            }
            const record = yield query.executeTakeFirst();
            return record !== null && record !== void 0 ? record : null;
        });
    }
    create(data, trx) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const executor = trx !== null && trx !== void 0 ? trx : this.db;
            return executor
                .insertInto(exports.PASSWORD_RECOVERIES_TABLE)
                .values(Object.assign(Object.assign({}, data), { tries: (_a = data.tries) !== null && _a !== void 0 ? _a : 0, next_try_at: (_b = data.next_try_at) !== null && _b !== void 0 ? _b : null }))
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }
    update(id, data, trx) {
        return __awaiter(this, void 0, void 0, function* () {
            const executor = trx !== null && trx !== void 0 ? trx : this.db;
            // Never overwrite the primary key or creation timestamp.
            const { id: _ignoredId, created_at: _ignoredCreatedAt } = data, updatable = __rest(data, ["id", "created_at"]);
            const record = yield executor
                .updateTable(exports.PASSWORD_RECOVERIES_TABLE)
                .set(Object.assign(Object.assign({}, updatable), { updated_at: new Date() }))
                .where("id", "=", id)
                .returningAll()
                .executeTakeFirst();
            return record !== null && record !== void 0 ? record : null;
        });
    }
    deleteById(id, trx) {
        return __awaiter(this, void 0, void 0, function* () {
            const executor = trx !== null && trx !== void 0 ? trx : this.db;
            const result = yield executor
                .deleteFrom(exports.PASSWORD_RECOVERIES_TABLE)
                .where("id", "=", id)
                .executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
    deleteBySendTo(sendTo, type, trx) {
        return __awaiter(this, void 0, void 0, function* () {
            const executor = trx !== null && trx !== void 0 ? trx : this.db;
            let query = executor
                .deleteFrom(exports.PASSWORD_RECOVERIES_TABLE)
                .where("send_to", "=", sendTo);
            if (type) {
                query = query.where("type", "=", type);
            }
            const result = yield query.executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
    /**
     * Deletes every recovery record for a user.
     *
     * Called when the password changes so a stale recovery code cannot
     * be redeemed afterwards.
     */
    deleteAllByUserId(userId, trx) {
        return __awaiter(this, void 0, void 0, function* () {
            const executor = trx !== null && trx !== void 0 ? trx : this.db;
            const result = yield executor
                .deleteFrom(exports.PASSWORD_RECOVERIES_TABLE)
                .where("user_id", "=", userId)
                .executeTakeFirst();
            return Number(result.numDeletedRows);
        });
    }
    withTransaction(callback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!("transaction" in this.db)) {
                throw new Error("withTransaction requires the shared database instance, not a transaction.");
            }
            return this.db.transaction().execute(callback);
        });
    }
    updateTries(id, tries, nextTryAt) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.PASSWORD_RECOVERIES_TABLE)
                .set({
                tries,
                next_try_at: nextTryAt,
                updated_at: new Date(),
            })
                .where("id", "=", id)
                .execute();
        });
    }
}
exports.PasswordRecoveryRepository = PasswordRecoveryRepository;
