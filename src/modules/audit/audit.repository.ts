// src/modules/audit/audit.repository.ts
import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../config/database";
import type {AuditEvent, AuditLogEntry, BrowseAuditQuery} from "./audit.interface";

export const AUDIT_LOG_TABLE = "audit_logs";

export class AuditRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    /**
     * Appends an audit event.
     *
     * The table is append-only (enforced by a database trigger), so
     * there is no update or delete path here by design.
     */
    async append(
        event: AuditEvent,
        executor: DatabaseExecutor = this.db,
    ): Promise<AuditLogEntry> {
        return executor
            .insertInto(AUDIT_LOG_TABLE)
            .values({
                occurred_at: new Date(),
                actor_user_id: event.actorUserId ?? null,
                actor_type: event.actorType ?? "anonymous",
                action: event.action,
                target_type: event.targetType ?? null,
                target_id:
                    event.targetId === null || event.targetId === undefined
                        ? null
                        : String(event.targetId),
                outcome: event.outcome,
                request_id: event.requestId ?? null,
                ip: event.ip ?? null,
                user_agent: event.userAgent?.slice(0, 255) ?? null,
                metadata: (event.metadata ?? {}) as never,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    /**
     * Lists audit events with filters and offset pagination.
     */
    async browse(filters: BrowseAuditQuery): Promise<AuditLogEntry[]> {
        const {actorUserId, action, outcome, from, to, page, perPage} =
            filters;

        let query = this.db
            .selectFrom(AUDIT_LOG_TABLE)
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
    }

    /**
     * Counts audit events matching the filters.
     */
    async count(filters: BrowseAuditQuery): Promise<number> {
        const {actorUserId, action, outcome, from, to} = filters;

        let query = this.db
            .selectFrom(AUDIT_LOG_TABLE)
            .select((eb) => eb.fn.countAll<number>().as("count"));

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

        const result = await query.executeTakeFirst();

        return Number(result?.count ?? 0);
    }

    /**
     * Removes audit rows older than the retention window.
     *
     * Retention is enforced by the cleanup job; the append-only trigger
     * still applies to this delete, so retention runs with a dedicated
     * role or is executed by the migration owner.
     */
    async purgeOlderThan(before: Date): Promise<number> {
        const result = await this.db
            .deleteFrom(AUDIT_LOG_TABLE)
            .where("occurred_at", "<", before)
            .executeTakeFirst();

        return Number(result.numDeletedRows);
    }

    /**
     * Verifies that the append-only trigger is still installed.
     */
    async isAppendOnly(): Promise<boolean> {
        const result = await sql<{count: number}>`
            SELECT COUNT(*)::int AS count
            FROM pg_trigger
            WHERE tgname = 'audit_logs_append_only'
              AND NOT tgisinternal
        `.execute(this.db);

        return Number(result.rows[0]?.count ?? 0) > 0;
    }
}
