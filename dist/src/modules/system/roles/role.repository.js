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
exports.RoleRepository = exports.ROLE_TABLE = void 0;
const database_1 = require("../../../config/database");
exports.ROLE_TABLE = "roles";
const ROLE_COLUMNS = [
    "id",
    "name",
    "slug",
    "description",
    "is_public",
    "is_bypass_authorization",
    "created_at",
    "updated_at",
];
/**
 * Escapes PostgreSQL LIKE wildcards so free-text search can never
 * change the meaning of the pattern.
 */
function escapeLikePattern(value) {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
class RoleRepository {
    /**
     * Constructor defaults to the application's database instance,
     * but allows dependency injection for tests.
     */
    constructor(db = database_1.db) {
        this.db = db;
    }
    /**
     * Convert a database row into the application/domain representation.
     */
    mapToRole(row) {
        return Object.assign(Object.assign({}, row), { is_public: Boolean(row.is_public), is_bypass_authorization: Boolean(row.is_bypass_authorization) });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.ROLE_TABLE)
                .select(ROLE_COLUMNS)
                .where("id", "=", id)
                .executeTakeFirst();
            return row
                ? this.mapToRole(row)
                : null;
        });
    }
    findBySlug(slug) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.ROLE_TABLE)
                .selectAll()
                .where("slug", "=", slug)
                .executeTakeFirst();
            return row
                ? this.mapToRole(row)
                : null;
        });
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const newRow = yield this.db
                .insertInto(exports.ROLE_TABLE)
                .values({
                name: data.name,
                slug: data.slug,
                description: data.description || null,
                is_public: (_a = data.is_public) !== null && _a !== void 0 ? _a : false,
                is_bypass_authorization: (_b = data.is_bypass_authorization) !== null && _b !== void 0 ? _b : false,
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.mapToRole(newRow);
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedRow = yield this.db
                .updateTable(exports.ROLE_TABLE)
                .set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (data.name !== undefined && {
                name: data.name,
            })), (data.slug !== undefined && {
                slug: data.slug,
            })), (data.description !== undefined && {
                description: data.description || null,
            })), (data.is_public !== undefined && {
                is_public: data.is_public,
            })), (data.is_bypass_authorization !== undefined && {
                is_bypass_authorization: data.is_bypass_authorization,
            })), { updated_at: new Date() }))
                .where("id", "=", id)
                .returningAll()
                .executeTakeFirst();
            return updatedRow
                ? this.mapToRole(updatedRow)
                : null;
        });
    }
    browse(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const { is_public, search, page, perPage, } = filters;
            const offset = (page - 1) * perPage;
            let query = this.db
                .selectFrom(exports.ROLE_TABLE)
                .select(ROLE_COLUMNS);
            if (is_public !== undefined) {
                query = query.where("is_public", "=", is_public);
            }
            if (search !== undefined && search.length > 0) {
                const keyword = `%${escapeLikePattern(search)}%`;
                query = query.where((eb) => eb.or([
                    eb("name", "like", keyword),
                    eb("slug", "like", keyword),
                    eb("description", "like", keyword),
                ]));
            }
            const rows = yield query
                .orderBy("id", "desc")
                .offset(offset)
                .limit(perPage)
                .execute();
            return rows.map(row => this.mapToRole(row));
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.ROLE_TABLE)
                .where("id", "=", id)
                .executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
}
exports.RoleRepository = RoleRepository;
