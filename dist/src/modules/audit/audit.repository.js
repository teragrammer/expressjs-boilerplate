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
exports.AuditRepository = exports.AUDIT_LOG_TABLE = void 0;
// src/modules/audit/audit.repository.ts
const kysely_1 = require("kysely");
const database_1 = require("../../config/database");
exports.AUDIT_LOG_TABLE = "audit_logs";
class AuditRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    /**
     * Appends an audit event.
     *
     * The table is append-only (enforced by a database trigger), so
     * there is no update or delete path here by design.
     */
    append(event_1) {
        return __awaiter(this, arguments, void 0, function* (event, executor = this.db) {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            return executor
                .insertInto(exports.AUDIT_LOG_TABLE)
                .values({
                occurred_at: new Date(),
                actor_user_id: (_a = event.actorUserId) !== null && _a !== void 0 ? _a : null,
                actor_type: (_b = event.actorType) !== null && _b !== void 0 ? _b : "anonymous",
                action: event.action,
                target_type: (_c = event.targetType) !== null && _c !== void 0 ? _c : null,
                target_id: event.targetId === null || event.targetId === undefined
                    ? null
                    : String(event.targetId),
                outcome: event.outcome,
                request_id: (_d = event.requestId) !== null && _d !== void 0 ? _d : null,
                ip: (_e = event.ip) !== null && _e !== void 0 ? _e : null,
                user_agent: (_g = (_f = event.userAgent) === null || _f === void 0 ? void 0 : _f.slice(0, 255)) !== null && _g !== void 0 ? _g : null,
                metadata: ((_h = event.metadata) !== null && _h !== void 0 ? _h : {}),
            })
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }
    /**
     * Lists audit events with filters and offset pagination.
     */
    browse(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const { actorUserId, action, outcome, from, to, page, perPage } = filters;
            let query = this.db
                .selectFrom(exports.AUDIT_LOG_TABLE)
                .selectAll();
            if (actorUserId !== undefined) {
                query = query.where("actor_user_id", "=", actorUserId);
            }
            if (action !== undefined) {
                query = query.where("action", "=", action);
            }
            if (outcome !== undefined) {
                query = query.where("outcome", "=", outcome);
            }
            if (from !== undefined) {
                query = query.where("occurred_at", ">=", from);
            }
            if (to !== undefined) {
                query = query.where("occurred_at", "<=", to);
            }
            return query
                .orderBy("occurred_at", "desc")
                .orderBy("id", "desc")
                .offset((page - 1) * perPage)
                .limit(perPage)
                .execute();
        });
    }
    /**
     * Counts audit events matching the filters.
     */
    count(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const { actorUserId, action, outcome, from, to } = filters;
            let query = this.db
                .selectFrom(exports.AUDIT_LOG_TABLE)
                .select((eb) => eb.fn.countAll().as("count"));
            if (actorUserId !== undefined) {
                query = query.where("actor_user_id", "=", actorUserId);
            }
            if (action !== undefined) {
                query = query.where("action", "=", action);
            }
            if (outcome !== undefined) {
                query = query.where("outcome", "=", outcome);
            }
            if (from !== undefined) {
                query = query.where("occurred_at", ">=", from);
            }
            if (to !== undefined) {
                query = query.where("occurred_at", "<=", to);
            }
            const result = yield query.executeTakeFirst();
            return Number((_a = result === null || result === void 0 ? void 0 : result.count) !== null && _a !== void 0 ? _a : 0);
        });
    }
    /**
     * Removes audit rows older than the retention window.
     *
     * Retention is enforced by the cleanup job; the append-only trigger
     * still applies to this delete, so retention runs with a dedicated
     * role or is executed by the migration owner.
     */
    purgeOlderThan(before) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.AUDIT_LOG_TABLE)
                .where("occurred_at", "<", before)
                .executeTakeFirst();
            return Number(result.numDeletedRows);
        });
    }
    /**
     * Verifies that the append-only trigger is still installed.
     */
    isAppendOnly() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const result = yield (0, kysely_1.sql) `
            SELECT COUNT(*)::int AS count
            FROM pg_trigger
            WHERE tgname = 'audit_logs_append_only'
              AND NOT tgisinternal
        `.execute(this.db);
            return Number((_b = (_a = result.rows[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0) > 0;
        });
    }
}
exports.AuditRepository = AuditRepository;
