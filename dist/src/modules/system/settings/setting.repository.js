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
exports.SettingRepository = exports.SETTING_TABLE = void 0;
const database_1 = require("../../../config/database");
exports.SETTING_TABLE = "settings";
const SETTING_COLUMNS = [
    "id",
    "name",
    "slug",
    "value",
    "description",
    "type",
    "is_disabled",
    "is_public",
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
class SettingRepository {
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
    mapToSetting(row) {
        return Object.assign(Object.assign({}, row), { is_disabled: Boolean(row.is_disabled), is_public: Boolean(row.is_public) });
    }
    /**
     * Retrieves active settings filtered by slugs and visibility.
     */
    findBySlug() {
        return __awaiter(this, arguments, void 0, function* (slugs = [], is_public) {
            let query = this.db
                .selectFrom(exports.SETTING_TABLE)
                .selectAll()
                .where("is_disabled", "=", false);
            if (is_public !== undefined) {
                query = query.where("is_public", "=", is_public);
            }
            if (slugs.length > 0) {
                query = query.where("slug", "in", slugs);
            }
            const rows = yield query.execute();
            return rows.map(row => this.mapToSetting(row));
        });
    }
    /**
     * Creates a new setting.
     *
     * PostgreSQL RETURNING returns the inserted row in one round trip.
     */
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const newRow = yield this.db
                .insertInto(exports.SETTING_TABLE)
                .values({
                name: data.name,
                slug: data.slug,
                value: data.value,
                description: data.description,
                type: data.type,
                is_disabled: (_a = data.is_disabled) !== null && _a !== void 0 ? _a : false,
                is_public: (_b = data.is_public) !== null && _b !== void 0 ? _b : true,
            })
                .returningAll()
                .executeTakeFirstOrThrow();
            return this.mapToSetting(newRow);
        });
    }
    update(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const updatedRow = yield this.db
                .updateTable(exports.SETTING_TABLE)
                .set(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (data.name !== undefined && {
                name: data.name,
            })), (data.slug !== undefined && {
                slug: data.slug,
            })), (data.value !== undefined && {
                value: data.value,
            })), (data.description !== undefined && {
                description: data.description,
            })), (data.type !== undefined && {
                type: data.type,
            })), (data.is_disabled !== undefined && {
                is_disabled: data.is_disabled,
            })), (data.is_public !== undefined && {
                is_public: data.is_public,
            })), { updated_at: new Date() }))
                .where("id", "=", id)
                .returningAll()
                .executeTakeFirst();
            return updatedRow
                ? this.mapToSetting(updatedRow)
                : null;
        });
    }
    browse(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const { is_disabled, is_public, type, search, page, perPage, } = filters;
            const offset = (page - 1) * perPage;
            let query = this.db
                .selectFrom(exports.SETTING_TABLE)
                .select(SETTING_COLUMNS);
            if (is_disabled !== undefined) {
                query = query.where("is_disabled", "=", is_disabled);
            }
            if (is_public !== undefined) {
                query = query.where("is_public", "=", is_public);
            }
            if (type !== undefined) {
                query = query.where("type", "=", type);
            }
            if (search !== undefined && search.length > 0) {
                const keyword = `%${escapeLikePattern(search)}%`;
                query = query.where((eb) => eb.or([
                    eb("name", "like", keyword),
                    eb("slug", "like", keyword),
                    eb("value", "like", keyword),
                ]));
            }
            const rows = yield query
                .orderBy("id", "desc")
                .offset(offset)
                .limit(perPage)
                .execute();
            return rows.map(row => this.mapToSetting(row));
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.SETTING_TABLE)
                .select(SETTING_COLUMNS)
                .where("id", "=", id)
                .executeTakeFirst();
            return row
                ? this.mapToSetting(row)
                : null;
        });
    }
    hardDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.SETTING_TABLE)
                .where("id", "=", id)
                .executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
}
exports.SettingRepository = SettingRepository;
