// src/modules/jobs/outbox.worker.ts
import {randomUUID} from "node:crypto";
import {__ENV} from "../../config/environment";
import {logger} from "../../config/logger";
import {
    outboxEventsTotal,
    outboxQueueDepth,
} from "../../common/metrics/metrics";
import {OutboxRepository} from "./outbox.repository";
import {
    OutboxEvent,
    OutboxHandler,
    OutboxType,
} from "./outbox.interface";

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
export class OutboxWorker {
    private readonly workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
    private readonly handlers = new Map<string, OutboxHandler>();
    private timer?: NodeJS.Timeout;
    private running = false;
    private stopped = false;

    constructor(
        private readonly outboxRepository: OutboxRepository,
    ) {
    }

    /**
     * Registers a handler for an event type.
     */
    register(type: OutboxType, handler: OutboxHandler): void {
        this.handlers.set(type, handler);
    }

    /**
     * Starts the polling loop.
     */
    start(): void {
        if (this.running) {
            return;
        }

        this.running = true;
        this.stopped = false;

        this.timer = setInterval(() => {
            void this.tick();
        }, __ENV.OUTBOX_POLL_INTERVAL_MS);

        this.timer.unref();

        logger.info(
            `[Outbox] Worker ${this.workerId} started ` +
            `(interval ${__ENV.OUTBOX_POLL_INTERVAL_MS}ms)`,
        );
    }

    /**
     * Stops the polling loop.
     */
    stop(): void {
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
    async tick(): Promise<number> {
        if (this.stopped) {
            return 0;
        }

        try {
            const events = await this.outboxRepository.claimBatch(
                __ENV.OUTBOX_BATCH_SIZE,
                this.workerId,
            );

            if (events.length === 0) {
                outboxQueueDepth.set(0);
                return 0;
            }

            for (const event of events) {
                await this.process(event);
            }

            outboxQueueDepth.set(
                await this.outboxRepository.pendingCount(),
            );

            return events.length;
        } catch (error) {
            logger.error(
                {message: (error as Error).message},
                "Outbox worker tick failed",
            );

            return 0;
        }
    }

    private async process(event: OutboxEvent): Promise<void> {
        const handler = this.handlers.get(event.type);

        if (!handler) {
            logger.warn(
                {type: event.type, id: event.id},
                "No outbox handler registered; event parked",
            );

            await this.outboxRepository.markFailed(
                event.id,
                `No handler registered for type ${event.type}`,
                MAX_ATTEMPTS,
            );

            outboxEventsTotal.inc({type: event.type, outcome: "unhandled"});
            return;
        }

        try {
            await handler({event, workerId: this.workerId});

            await this.outboxRepository.markDone(event.id);

            outboxEventsTotal.inc({type: event.type, outcome: "success"});
        } catch (error) {
            const message = (error as Error).message;

            logger.error(
                {type: event.type, id: event.id, message},
                "Outbox event processing failed",
            );

            await this.outboxRepository.markFailed(
                event.id,
                message,
                MAX_ATTEMPTS,
            );

            outboxEventsTotal.inc({type: event.type, outcome: "failure"});
        }
    }
}
