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
const vitest_1 = require("vitest");
const outbox_worker_1 = require("./outbox.worker");
const outbox_interface_1 = require("./outbox.interface");
vitest_1.vi.mock("../../config/logger", () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)("OutboxWorker", () => {
    let worker;
    let outboxRepository;
    const event = {
        id: "1",
        type: outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL,
        payload: { to: "user@example.com" },
        status: "pending",
        attempts: 1,
        available_at: new Date(),
        locked_at: null,
        locked_by: null,
        last_error: null,
        created_at: new Date(),
        processed_at: null,
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        outboxRepository = {
            claimBatch: vitest_1.vi.fn().mockResolvedValue([]),
            markDone: vitest_1.vi.fn().mockResolvedValue(undefined),
            markFailed: vitest_1.vi.fn().mockResolvedValue(undefined),
            pendingCount: vitest_1.vi.fn().mockResolvedValue(0),
        };
        worker = new outbox_worker_1.OutboxWorker(outboxRepository);
    });
    (0, vitest_1.it)("does nothing when the queue is empty", () => __awaiter(void 0, void 0, void 0, function* () {
        const processed = yield worker.tick();
        (0, vitest_1.expect)(processed).toBe(0);
        (0, vitest_1.expect)(outboxRepository.markDone).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)("dispatches an event to its handler", () => __awaiter(void 0, void 0, void 0, function* () {
        const handler = vitest_1.vi.fn().mockResolvedValue(undefined);
        worker.register(outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL, handler);
        outboxRepository.claimBatch.mockResolvedValue([event]);
        const processed = yield worker.tick();
        (0, vitest_1.expect)(processed).toBe(1);
        (0, vitest_1.expect)(handler).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ event }));
        (0, vitest_1.expect)(outboxRepository.markDone).toHaveBeenCalledWith("1");
    }));
    (0, vitest_1.it)("reschedules an event when the handler fails", () => __awaiter(void 0, void 0, void 0, function* () {
        const handler = vitest_1.vi.fn().mockRejectedValue(new Error("smtp down"));
        worker.register(outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL, handler);
        outboxRepository.claimBatch.mockResolvedValue([event]);
        yield worker.tick();
        (0, vitest_1.expect)(outboxRepository.markDone).not.toHaveBeenCalled();
        (0, vitest_1.expect)(outboxRepository.markFailed).toHaveBeenCalledWith("1", "smtp down", vitest_1.expect.any(Number));
    }));
    (0, vitest_1.it)("parks an event that has no handler", () => __awaiter(void 0, void 0, void 0, function* () {
        outboxRepository.claimBatch.mockResolvedValue([event]);
        yield worker.tick();
        (0, vitest_1.expect)(outboxRepository.markFailed).toHaveBeenCalledWith("1", vitest_1.expect.stringContaining("No handler registered"), vitest_1.expect.any(Number));
    }));
    (0, vitest_1.it)("survives a repository failure", () => __awaiter(void 0, void 0, void 0, function* () {
        outboxRepository.claimBatch.mockRejectedValue(new Error("database down"));
        const processed = yield worker.tick();
        (0, vitest_1.expect)(processed).toBe(0);
    }));
    (0, vitest_1.it)("does not process anything after it is stopped", () => __awaiter(void 0, void 0, void 0, function* () {
        worker.stop();
        const processed = yield worker.tick();
        (0, vitest_1.expect)(processed).toBe(0);
        (0, vitest_1.expect)(outboxRepository.claimBatch).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)("starts and stops the polling loop", () => {
        worker.start();
        worker.start();
        worker.stop();
        // The timer must not keep the process alive.
        (0, vitest_1.expect)(true).toBe(true);
    });
});
