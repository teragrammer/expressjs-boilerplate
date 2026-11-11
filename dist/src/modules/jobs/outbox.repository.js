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
exports.OutboxRepository = exports.OUTBOX_EVENT_TABLE = void 0;
// src/modules/jobs/outbox.repository.ts
const kysely_1 = require("kysely");
const database_1 = require("../../config/database");
exports.OUTBOX_EVENT_TABLE = "outbox_events";
class OutboxRepository {
    constructor(db = database_1.db) {
        this.db = db;
    }
    /**
     * Enqueues an event.
     *
     * Callers write the event inside the same transaction as the
     * business change, so a rolled-back transaction never produces an
     * email or a background job.
     */
    enqueue(event_1) {
        return __awaiter(this, arguments, void 0, function* (event, executor = this.db) {
            var _a;
            return executor
                .insertInto(exports.OUTBOX_EVENT_TABLE)
                .values({
                type: event.type,
                payload: event.payload,
                status: "pending",
                available_at: (_a = event.availableAt) !== null && _a !== void 0 ? _a : new Date(),
            })
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }
    /**
     * Claims a batch of due events for processing.
     *
     * `FOR UPDATE SKIP LOCKED` lets several workers poll the same table
     * without blocking each other or processing an event twice.
     */
    claimBatch(limit, workerId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.db
                .transaction()
                .execute((trx) => __awaiter(this, void 0, void 0, function* () {
                const events = yield trx
                    .selectFrom(exports.OUTBOX_EVENT_TABLE)
                    .selectAll()
                    .where("status", "=", "pending")
                    .where("available_at", "<=", (0, kysely_1.sql) `now()`)
                    .orderBy("id", "asc")
                    .limit(limit)
                    .forUpdate()
                    .skipLocked()
                    .execute();
                if (events.length === 0) {
                    return [];
                }
                const ids = events.map((event) => event.id);
                yield trx
                    .updateTable(exports.OUTBOX_EVENT_TABLE)
                    .set({
                    status: "processing",
                    locked_at: new Date(),
                    locked_by: workerId,
                    attempts: (0, kysely_1.sql) `attempts + 1`,
                    updated_at: new Date(),
                })
                    .where("id", "in", ids)
                    .execute();
                return events.map((event) => (Object.assign(Object.assign({}, event), { status: "processing", attempts: event.attempts + 1 })));
            }));
        });
    }
    /**
     * Marks an event as successfully processed.
     */
    markDone(id) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db
                .updateTable(exports.OUTBOX_EVENT_TABLE)
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
        });
    }
    /**
     * Records a failure.
     *
     * The event is rescheduled with exponential backoff until the
     * maximum attempt count is reached, after which it is parked in the
     * failed state for manual review.
     */
    markFailed(id, error, maxAttempts) {
        return __awaiter(this, void 0, void 0, function* () {
            const attempts = yield this.getAttempts(id);
            if (attempts >= maxAttempts) {
                yield this.db
                    .updateTable(exports.OUTBOX_EVENT_TABLE)
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
            const backoffMs = Math.min(60000, Math.pow(2, Math.min(attempts, 6)) * 1000);
            yield this.db
                .updateTable(exports.OUTBOX_EVENT_TABLE)
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
        });
    }
    getAttempts(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const row = yield this.db
                .selectFrom(exports.OUTBOX_EVENT_TABLE)
                .select("attempts")
                .where("id", "=", id)
                .executeTakeFirst();
            return Number((_a = row === null || row === void 0 ? void 0 : row.attempts) !== null && _a !== void 0 ? _a : 0);
        });
    }
    /**
     * Counts pending events (queue depth metric).
     */
    pendingCount() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const row = yield this.db
                .selectFrom(exports.OUTBOX_EVENT_TABLE)
                .select((eb) => eb.fn.countAll().as("count"))
                .where("status", "=", "pending")
                .executeTakeFirst();
            return Number((_a = row === null || row === void 0 ? void 0 : row.count) !== null && _a !== void 0 ? _a : 0);
        });
    }
    /**
     * Removes processed events older than the retention window.
     */
    purgeProcessed(olderThan) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.db
                .deleteFrom(exports.OUTBOX_EVENT_TABLE)
                .where("status", "=", "done")
                .where("processed_at", "<", olderThan)
                .executeTakeFirst();
            return Number(result.numDeletedRows);
        });
    }
}
exports.OutboxRepository = OutboxRepository;
