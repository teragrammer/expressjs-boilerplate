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
exports.OutboxWorker = void 0;
// src/modules/jobs/outbox.worker.ts
const node_crypto_1 = require("node:crypto");
const environment_1 = require("../../config/environment");
const logger_1 = require("../../config/logger");
const metrics_1 = require("../../common/metrics/metrics");
/**
 * Maximum attempts before an event is parked as failed.
 */
const MAX_ATTEMPTS = 5;
/**
 * Polls the outbox table and dispatches events to their handlers.
 *
 * The worker is idempotent by design: handlers must tolerate being
 * called again for an event that was already processed.
 */
class OutboxWorker {
    constructor(outboxRepository) {
        this.outboxRepository = outboxRepository;
        this.workerId = `worker-${process.pid}-${(0, node_crypto_1.randomUUID)().slice(0, 8)}`;
        this.handlers = new Map();
        this.running = false;
        this.stopped = false;
    }
    /**
     * Registers a handler for an event type.
     */
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    /**
     * Starts the polling loop.
     */
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.stopped = false;
        this.timer = setInterval(() => {
            void this.tick();
        }, environment_1.__ENV.OUTBOX_POLL_INTERVAL_MS);
        this.timer.unref();
        logger_1.logger.info(`[Outbox] Worker ${this.workerId} started ` +
            `(interval ${environment_1.__ENV.OUTBOX_POLL_INTERVAL_MS}ms)`);
    }
    /**
     * Stops the polling loop.
     */
    stop() {
        this.stopped = true;
        this.running = false;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    /**
     * Processes one batch of events.
     */
    tick() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.stopped) {
                return 0;
            }
            try {
                const events = yield this.outboxRepository.claimBatch(environment_1.__ENV.OUTBOX_BATCH_SIZE, this.workerId);
                if (events.length === 0) {
                    metrics_1.outboxQueueDepth.set(0);
                    return 0;
                }
                for (const event of events) {
                    yield this.process(event);
                }
                metrics_1.outboxQueueDepth.set(yield this.outboxRepository.pendingCount());
                return events.length;
            }
            catch (error) {
                logger_1.logger.error({ message: error.message }, "Outbox worker tick failed");
                return 0;
            }
        });
    }
    process(event) {
        return __awaiter(this, void 0, void 0, function* () {
            const handler = this.handlers.get(event.type);
            if (!handler) {
                logger_1.logger.warn({ type: event.type, id: event.id }, "No outbox handler registered; event parked");
                yield this.outboxRepository.markFailed(event.id, `No handler registered for type ${event.type}`, MAX_ATTEMPTS);
                metrics_1.outboxEventsTotal.inc({ type: event.type, outcome: "unhandled" });
                return;
            }
            try {
                yield handler({ event, workerId: this.workerId });
                yield this.outboxRepository.markDone(event.id);
                metrics_1.outboxEventsTotal.inc({ type: event.type, outcome: "success" });
            }
            catch (error) {
                const message = error.message;
                logger_1.logger.error({ type: event.type, id: event.id, message }, "Outbox event processing failed");
                yield this.outboxRepository.markFailed(event.id, message, MAX_ATTEMPTS);
                metrics_1.outboxEventsTotal.inc({ type: event.type, outcome: "failure" });
            }
        });
    }
}
exports.OutboxWorker = OutboxWorker;
