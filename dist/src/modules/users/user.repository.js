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
exports.UserRepository = exports.USER_TABLE = void 0;
// src/modules/users/user.repository.ts
const kysely_1 = require("kysely");
const database_1 = require("../../config/database");
exports.USER_TABLE = "users";
const USER_PUBLIC_COLUMNS = [
    "id",
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "address",
    "phone",
    "is_phone_verified",
    "email",
    "is_email_verified",
    "has_tfa",
    "role_id",
    "username",
    "status",
    "comments",
    "created_at",
    "updated_at",
    "authorization_version",
];
/**
 * Escapes PostgreSQL LIKE wildcards so free-text search can never
 * change the meaning of the pattern.
 */
function escapeLikePattern(value) {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
class UserRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    mapToUser(row) {
        return Object.assign(Object.assign({}, row), { is_phone_verified: Boolean(row.is_phone_verified), is_email_verified: Boolean(row.is_email_verified), has_tfa: Boolean(row.has_tfa), authorization_version: Number(row.authorization_version) });
    }
    activeUsers() {
        return this.db
            .selectFrom(exports.USER_TABLE)
            .selectAll()
            .where("deleted_at", "is", null);
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.USER_TABLE)
                .select(USER_PUBLIC_COLUMNS)
                .where("id", "=", id)
                .where("deleted_at", "is", null)
                .executeTakeFirst();
            return row ? this.mapToUser(row) : null;
        });
    }
    /**
     * Internal lookup that includes sensitive columns such as password.
     * Used only for authentication/account flows, never for public API responses.
     */
    findAuthById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.activeUsers()
                .where("id", "=", id)
                .executeTakeFirst();
            return row ? this.mapToUser(row) : null;
        });
    }
    findByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.activeUsers()
                .where("email", "=", email)
                .executeTakeFirst();
            return row ? this.mapToUser(row) : null;
        });
    }
    findByPhone(phone) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.activeUsers()
                .where("phone", "=", phone)
                .executeTakeFirst();
            return row ? this.mapToUser(row) : null;
        });
    }
    findByUsername(username) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.activeUsers()
                .where("username", "=", username)
                .executeTakeFirst();
            return row ? this.mapToUser(row) : null;
        });
    }
    create(data_1) {
        return __awaiter(this, arguments, void 0, function* (data, executor = this.db) {
            const newRow = yield executor
                .insertInto(exports.USER_TABLE)
                .values({
                first_name: data.first_name || null,
                middle_name: data.middle_name || null,
                last_name: data.last_name || null,
                gender: data.gender || null,
                address: data.address || null,
                phone: data.phone || null,
                is_phone_verified: false,
                email: data.email || null,
                is_email_verified: false,
                has_tfa: false,
                role_id: data.role_id,
                username: data.username || null,
                password: data.password || null,
                status: data.status || "Activated",
                login_tries: 0,
                failed_login_expired_at: null,
                comments: data.comments || null,
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.mapToUser(newRow);
        });
    }
    update(id_1, data_1, status_1) {
        return __awaiter(this, arguments, void 0, function* (id, data, status, executor = this.db) {
            const existingRow = yield executor
                .selectFrom(exports.USER_TABLE)
                .select("id")
                .where("id", "=", id)
                .where("deleted_at", "is", null)
                .executeTakeFirst();
            if (!existingRow) {
                return null;
            }
            let query = executor
                .updateTable(exports.USER_TABLE)
                .set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (data.first_name !== undefined && {
                first_name: data.first_name,
            })), (data.middle_name !== undefined && {
                middle_name: data.middle_name,
            })), (data.last_name !== undefined && {
                last_name: data.last_name,
            })), (data.gender !== undefined && {
                gender: data.gender,
            })), (data.address !== undefined && {
                address: data.address,
            })), (data.phone !== undefined && {
                phone: data.phone,
            })), (data.is_phone_verified !== undefined && {
                is_phone_verified: data.is_phone_verified,
            })), (data.email !== undefined && {
                email: data.email,
            })), (data.is_email_verified !== undefined && {
                is_email_verified: data.is_email_verified,
            })), (data.has_tfa !== undefined && {
                has_tfa: data.has_tfa,
            })), (data.tfa_secret !== undefined && {
                tfa_secret: data.tfa_secret,
            })), (data.role_id !== undefined && {
                role_id: data.role_id,
            })), (data.username !== undefined && {
                username: data.username,
            })), (data.password !== undefined && {
                password: data.password,
            })), (data.status !== undefined && {
                status: data.status,
            })), (data.login_tries !== undefined && {
                login_tries: data.login_tries,
            })), (data.failed_login_expired_at !== undefined && {
                failed_login_expired_at: data.failed_login_expired_at,
            })), (data.comments !== undefined && {
                comments: data.comments,
            })), { updated_at: new Date() }))
                .where("id", "=", id)
                .where("deleted_at", "is", null);
            if (status !== undefined) {
                query = query.where("status", "=", status);
            }
            const updatedRow = yield query
                .returningAll()
                .executeTakeFirst();
            return updatedRow
                ? this.mapToUser(updatedRow)
                : null;
        });
    }
    /**
     * Cursor-based user browsing.
     *
     * Uses the primary key for stable and efficient pagination:
     *
     * WHERE id < cursor
     * ORDER BY id DESC
     * LIMIT limit + 1
     *
     * No COUNT(*) and no OFFSET are required.
     */
    browse(query) {
        return __awaiter(this, void 0, void 0, function* () {
            const { role_id, status, search, cursor, limit, } = query;
            let baseQuery = this.db
                .selectFrom(exports.USER_TABLE)
                .select(USER_PUBLIC_COLUMNS)
                .where("deleted_at", "is", null);
            if (role_id !== undefined) {
                baseQuery = baseQuery.where("role_id", "=", role_id);
            }
            if (status !== undefined) {
                baseQuery = baseQuery.where("status", "=", status);
            }
            if (cursor !== undefined) {
                baseQuery = baseQuery.where("id", "<", cursor);
            }
            if (search) {
                const keyword = `%${escapeLikePattern(search)}%`;
                baseQuery = baseQuery.where((eb) => eb.or([
                    eb("first_name", "like", keyword),
                    eb("middle_name", "like", keyword),
                    eb("last_name", "like", keyword),
                    eb("username", "like", keyword),
                    eb("phone", "like", keyword),
                    eb("email", "like", keyword),
                ]));
            }
            const rows = yield baseQuery
                .orderBy("id", "desc")
                .limit(limit + 1)
                .execute();
            const hasMore = rows.length > limit;
            const data = rows
                .slice(0, limit)
                .map((row) => (Object.assign(Object.assign({}, row), { is_phone_verified: Boolean(row.is_phone_verified), is_email_verified: Boolean(row.is_email_verified), has_tfa: Boolean(row.has_tfa), authorization_version: Number(row.authorization_version) })));
            const nextCursor = hasMore && data.length > 0
                ? data[data.length - 1].id
                : null;
            return {
                data,
                hasMore,
                nextCursor,
            };
        });
    }
    updatePassword(id, password, trx) {
        return __awaiter(this, void 0, void 0, function* () {
            const executor = trx !== null && trx !== void 0 ? trx : this.db;
            const result = yield executor
                .updateTable(exports.USER_TABLE)
                .set({
                password,
                updated_at: (0, kysely_1.sql) `now()`,
            })
                .where("id", "=", id)
                .where("deleted_at", "is", null)
                .executeTakeFirst();
            return Number(result.numUpdatedRows) > 0;
        });
    }
    incrementLoginTries(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedRow = yield this.db
                .updateTable(exports.USER_TABLE)
                .set({
                login_tries: (0, kysely_1.sql) `login_tries + 1`,
                updated_at: (0, kysely_1.sql) `now()`,
            })
                .where("id", "=", id)
                .where("deleted_at", "is", null)
                .returningAll()
                .executeTakeFirst();
            return updatedRow
                ? this.mapToUser(updatedRow)
                : null;
        });
    }
    softDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .updateTable(exports.USER_TABLE)
                .set({
                deleted_at: new Date(),
                updated_at: new Date(),
            })
                .where("id", "=", id)
                .where("deleted_at", "is", null)
                .executeTakeFirst();
            return Number(result.numUpdatedRows) > 0;
        });
    }
    hardDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.USER_TABLE)
                .where("id", "=", id)
                .executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
}
exports.UserRepository = UserRepository;
