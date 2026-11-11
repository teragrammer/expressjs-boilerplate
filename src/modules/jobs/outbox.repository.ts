// src/modules/jobs/outbox.repository.ts
import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../config/database";
import {
    CreateOutboxEvent,
    OutboxEvent,
} from "./outbox.interface";

export const OUTBOX_EVENT_TABLE = "outbox_events";

export class OutboxRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    /**
     * Enqueues an event.
     *
     * Callers write the event inside the same transaction as the
     * business change, so a rolled-back transaction never produces an
     * email or a background job.
     */
    async enqueue(
        event: CreateOutboxEvent,
        executor: DatabaseExecutor = this.db,
    ): Promise<OutboxEvent> {
        return executor
            .insertInto(OUTBOX_EVENT_TABLE)
            .values({
                type: event.type,
                payload: event.payload as never,
                status: "pending",
                available_at: event.availableAt ?? new Date(),
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    /**
     * Claims a batch of due events for processing.
     *
     * `FOR UPDATE SKIP LOCKED` lets several workers poll the same table
     * without blocking each other or processing an event twice.
     */
    async claimBatch(
        limit: number,
        workerId: string,
    ): Promise<OutboxEvent[]> {
        return this.db
            .transaction()
            .execute(async (trx) => {
                const events = await trx
                    .selectFrom(OUTBOX_EVENT_TABLE)
                    .selectAll()
                    .where("status", "=", "pending")
                    .where("available_at", "<=", sql<Date>`now()`)
                    .orderBy("id", "asc")
                    .limit(limit)
                    .forUpdate()
                    .skipLocked()
                    .execute();

                if (events.length === 0) {
                    return [];
                }

                const ids = events.map((event) => event.id);

                await trx
                    .updateTable(OUTBOX_EVENT_TABLE)
                    .set({
                        status: "processing",
                        locked_at: new Date(),
                        locked_by: workerId,
                        attempts: sql<number>`attempts + 1`,
                        updated_at: new Date(),
                    })
                    .where("id", "in", ids)
                    .execute();

                return events.map((event) => ({
                    ...event,
                    status: "processing" as const,
                    attempts: event.attempts + 1,
                }));
            });
    }

    /**
     * Marks an event as successfully processed.
     */
    async markDone(id: string): Promise<void> {
        await this.db
            .updateTable(OUTBOX_EVENT_TABLE)
            .set({
                status: "done",
                processed_at: new Date(),
                locked_at: null,
                locked_by: null,
                last_error: null,
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .execute();
    }

    /**
     * Records a failure.
     *
     * The event is rescheduled with exponential backoff until the
     * maximum attempt count is reached, after which it is parked in the
     * failed state for manual review.
     */
    async markFailed(
        id: string,
        error: string,
        maxAttempts: number,
    ): Promise<void> {
        const attempts = await this.getAttempts(id);

        if (attempts >= maxAttempts) {
            await this.db
                .updateTable(OUTBOX_EVENT_TABLE)
                .set({
                    status: "failed",
                    last_error: error.slice(0, 2000),
                    locked_at: null,
                    locked_by: null,
                    updated_at: new Date(),
                })
                .where("id", "=", id)
                .execute();

            return;
        }

        const backoffMs = Math.min(
            60_000,
            2 ** Math.min(attempts, 6) * 1000,
        );

        await this.db
            .updateTable(OUTBOX_EVENT_TABLE)
            .set({
                status: "pending",
                available_at: new Date(Date.now() + backoffMs),
                last_error: error.slice(0, 2000),
                locked_at: null,
                locked_by: null,
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .execute();
    }

    private async getAttempts(id: string): Promise<number> {
        const row = await this.db
            .selectFrom(OUTBOX_EVENT_TABLE)
            .select("attempts")
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(row?.attempts ?? 0);
    }

    /**
     * Counts pending events (queue depth metric).
     */
    async pendingCount(): Promise<number> {
        const row = await this.db
            .selectFrom(OUTBOX_EVENT_TABLE)
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .where("status", "=", "pending")
            .executeTakeFirst();

        return Number(row?.count ?? 0);
    }

    /**
     * Removes processed events older than the retention window.
     */
    async purgeProcessed(olderThan: Date): Promise<number> {
        const result = await this.db
            .deleteFrom(OUTBOX_EVENT_TABLE)
            .where("status", "=", "done")
            .where("processed_at", "<", olderThan)
            .executeTakeFirst();

        return Number(result.numDeletedRows);
    }
}
