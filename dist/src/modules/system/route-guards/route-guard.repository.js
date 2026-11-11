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
exports.RouteGuardRepository = exports.ROUTE_GUARD_TABLE = void 0;
// src/modules/system/route-guards/route-guard.repository.ts
const database_1 = require("../../../config/database");
const role_repository_1 = require("../roles/role.repository");
exports.ROUTE_GUARD_TABLE = "route_guards";
const JOINED_COLUMNS = [
    "route_guards.id",
    "route_guards.role_id",
    "route_guards.route",
    "route_guards.created_at",
    "route_guards.updated_at",
    "roles.slug as role_slug",
];
class RouteGuardRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    /**
     * Base query for route guards that require role information.
     *
     * Keeping the join in one place prevents the same join and
     * select list from being duplicated across repository methods.
     */
    joinedQuery() {
        return this.db
            .selectFrom(exports.ROUTE_GUARD_TABLE)
            .innerJoin(role_repository_1.ROLE_TABLE, `${role_repository_1.ROLE_TABLE}.id`, `${exports.ROUTE_GUARD_TABLE}.role_id`)
            .select(JOINED_COLUMNS);
    }
    create(data) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.db
                .insertInto(exports.ROUTE_GUARD_TABLE)
                .values({
                role_id: data.role_id,
                route: data.route,
            })
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }
    browse(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const { role_id, page, perPage, } = filters;
            const offset = (page - 1) * perPage;
            let query = this.joinedQuery();
            if (role_id !== undefined) {
                query = query.where(`${exports.ROUTE_GUARD_TABLE}.role_id`, "=", role_id);
            }
            return query
                .orderBy(`${exports.ROUTE_GUARD_TABLE}.id`, "desc")
                .offset(offset)
                .limit(perPage)
                .execute();
        });
    }
    /**
     * Fetches all route guards with their role slugs.
     *
     * Used to build the authorization cache.
     */
    findRouteGuardsGroupedByRole() {
        return __awaiter(this, void 0, void 0, function* () {
            return this.joinedQuery().execute();
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.joinedQuery()
                .where(`${exports.ROUTE_GUARD_TABLE}.id`, "=", id)
                .executeTakeFirst();
            return row !== null && row !== void 0 ? row : null;
        });
    }
    /**
     * Finds a guard by its role and route pair.
     */
    findByRoleAndRoute(roleId, route) {
        return __awaiter(this, void 0, void 0, function* () {
            const row = yield this.db
                .selectFrom(exports.ROUTE_GUARD_TABLE)
                .selectAll()
                .where("role_id", "=", roleId)
                .where("route", "=", route)
                .executeTakeFirst();
            return row !== null && row !== void 0 ? row : null;
        });
    }
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.ROUTE_GUARD_TABLE)
                .where("id", "=", id)
                .executeTakeFirst();
            return Number(result.numDeletedRows) > 0;
        });
    }
}
exports.RouteGuardRepository = RouteGuardRepository;
