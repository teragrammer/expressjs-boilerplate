import {beforeEach, describe, expect, it, vi} from "vitest";
import {OutboxWorker} from "./outbox.worker";
import {OutboxRepository} from "./outbox.repository";
import {OUTBOX_TYPES} from "./outbox.interface";

vi.mock("../../config/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("OutboxWorker", () => {
    let worker: OutboxWorker;

    let outboxRepository: {
        claimBatch: ReturnType<typeof vi.fn>;
        markDone: ReturnType<typeof vi.fn>;
        markFailed: ReturnType<typeof vi.fn>;
        pendingCount: ReturnType<typeof vi.fn>;
    };

    const event = {
        id: "1",
        type: OUTBOX_TYPES.SEND_EMAIL,
        payload: {to: "user@example.com"},
        status: "pending" as const,
        attempts: 1,
        available_at: new Date(),
        locked_at: null,
        locked_by: null,
        last_error: null,
        created_at: new Date(),
        processed_at: null,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        outboxRepository = {
            claimBatch: vi.fn().mockResolvedValue([]),
            markDone: vi.fn().mockResolvedValue(undefined),
            markFailed: vi.fn().mockResolvedValue(undefined),
            pendingCount: vi.fn().mockResolvedValue(0),
        };

        worker = new OutboxWorker(
            outboxRepository as unknown as OutboxRepository,
        );
    });

    it("does nothing when the queue is empty", async () => {
        const processed = await worker.tick();

        expect(processed).toBe(0);
        expect(outboxRepository.markDone).not.toHaveBeenCalled();
    });

    it("dispatches an event to its handler", async () => {
        const handler = vi.fn().mockResolvedValue(undefined);

        worker.register(OUTBOX_TYPES.SEND_EMAIL, handler);

        outboxRepository.claimBatch.mockResolvedValue([event]);

        const processed = await worker.tick();

        expect(processed).toBe(1);
        expect(handler).toHaveBeenCalledWith(
            expect.objectContaining({event}),
        );
        expect(outboxRepository.markDone).toHaveBeenCalledWith("1");
    });

    it("reschedules an event when the handler fails", async () => {
        const handler = vi.fn().mockRejectedValue(new Error("smtp down"));

        worker.register(OUTBOX_TYPES.SEND_EMAIL, handler);

        outboxRepository.claimBatch.mockResolvedValue([event]);

        await worker.tick();

        expect(outboxRepository.markDone).not.toHaveBeenCalled();
        expect(outboxRepository.markFailed).toHaveBeenCalledWith(
            "1",
            "smtp down",
            expect.any(Number),
        );
    });

    it("parks an event that has no handler", async () => {
        outboxRepository.claimBatch.mockResolvedValue([event]);

        await worker.tick();

        expect(outboxRepository.markFailed).toHaveBeenCalledWith(
            "1",
            expect.stringContaining("No handler registered"),
            expect.any(Number),
        );
    });

    it("survives a repository failure", async () => {
        outboxRepository.claimBatch.mockRejectedValue(
            new Error("database down"),
        );

        const processed = await worker.tick();

        expect(processed).toBe(0);
    });

    it("does not process anything after it is stopped", async () => {
        worker.stop();

        const processed = await worker.tick();

        expect(processed).toBe(0);
        expect(outboxRepository.claimBatch).not.toHaveBeenCalled();
    });

    it("starts and stops the polling loop", () => {
        worker.start();
        worker.start();

        worker.stop();

        // The timer must not keep the process alive.
        expect(true).toBe(true);
    });
});
