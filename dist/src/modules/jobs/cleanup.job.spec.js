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
const cleanup_job_1 = require("./cleanup.job");
vitest_1.vi.mock("../../config/logger", () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock("../../config/database", () => ({
    db: {
        deleteFrom: vitest_1.vi.fn(),
    },
}));
const database_1 = require("../../config/database");
(0, vitest_1.describe)("CleanupJob", () => {
    let job;
    let db;
    /**
     * Builds a chainable delete query builder.
     *
     * The builder is created once per table so the row counter is
     * shared between the batches of the same table.
     */
    const builders = new Map();
    const builderFor = (table, rows) => {
        const existing = builders.get(table);
        if (existing) {
            return existing;
        }
        let index = 0;
        const builder = {
            where: vitest_1.vi.fn(() => builder),
            orWhere: vitest_1.vi.fn(() => builder),
            limit: vitest_1.vi.fn(() => builder),
            executeTakeFirst: vitest_1.vi.fn(() => __awaiter(void 0, void 0, void 0, function* () {
                var _a;
                return ({
                    numDeletedRows: (_a = rows[index++]) !== null && _a !== void 0 ? _a : 0,
                });
            })),
        };
        builders.set(table, builder);
        return builder;
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        builders.clear();
        db = database_1.db;
        db.deleteFrom.mockReset();
        job = new cleanup_job_1.CleanupJob();
    });
    (0, vitest_1.it)("removes the expired rows from every table", () => __awaiter(void 0, void 0, void 0, function* () {
        db.deleteFrom.mockImplementation((table) => builderFor(table, [1]));
        const result = yield job.run();
        (0, vitest_1.expect)(result.sessions).toBe(1);
        (0, vitest_1.expect)(result.recoveries).toBe(1);
        (0, vitest_1.expect)(result.tfa).toBe(1);
        (0, vitest_1.expect)(result.refreshTokens).toBe(1);
        (0, vitest_1.expect)(result.verifications).toBe(1);
        (0, vitest_1.expect)(result.rateLimits).toBe(1);
        (0, vitest_1.expect)(result.idempotencyKeys).toBe(1);
        const tables = db.deleteFrom.mock.calls.map((call) => call[0]);
        (0, vitest_1.expect)(tables).toContain("authentication_tokens");
        (0, vitest_1.expect)(tables).toContain("password_recoveries");
        (0, vitest_1.expect)(tables).toContain("two_factor_authentications");
        (0, vitest_1.expect)(tables).toContain("refresh_tokens");
        (0, vitest_1.expect)(tables).toContain("verification_tokens");
        (0, vitest_1.expect)(tables).toContain("rate_limits");
        (0, vitest_1.expect)(tables).toContain("idempotency_keys");
    }));
    (0, vitest_1.it)("stops deleting once a batch is smaller than the limit", () => __awaiter(void 0, void 0, void 0, function* () {
        // The first batch is full, the second is not.
        db.deleteFrom.mockImplementation((table) => builderFor(table, [1000, 3]));
        const result = yield job.run();
        // Two batches per table: 1000 + 3.
        (0, vitest_1.expect)(result.sessions).toBe(1003);
        // Seven tables, two batches each.
        (0, vitest_1.expect)(db.deleteFrom).toHaveBeenCalledTimes(14);
    }));
    (0, vitest_1.it)("starts and stops the schedule", () => {
        job.start();
        job.start();
        job.stop();
        (0, vitest_1.expect)(true).toBe(true);
    });
});
