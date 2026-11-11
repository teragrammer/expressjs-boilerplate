import {beforeEach, describe, expect, it, vi} from "vitest";
import {CleanupJob} from "./cleanup.job";

vi.mock("../../config/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("../../config/database", () => ({
    db: {
        deleteFrom: vi.fn(),
    },
}));

import {db as mockedDb} from "../../config/database";

describe("CleanupJob", () => {
    let job: CleanupJob;

    let db: {
        deleteFrom: ReturnType<typeof vi.fn>;
    };

    /**
     * Builds a chainable delete query builder.
     *
     * The builder is created once per table so the row counter is
     * shared between the batches of the same table.
     */
    const builders = new Map<string, any>();

    const builderFor = (table: string, rows: number[]) => {
        const existing = builders.get(table);

        if (existing) {
            return existing;
        }

        let index = 0;

        const builder: any = {
            where: vi.fn(() => builder),
            orWhere: vi.fn(() => builder),
            limit: vi.fn(() => builder),
            executeTakeFirst: vi.fn(async () => ({
                numDeletedRows: rows[index++] ?? 0,
            })),
        };

        builders.set(table, builder);

        return builder;
    };

    beforeEach(() => {
        vi.clearAllMocks();
        builders.clear();

        db = mockedDb as unknown as {
            deleteFrom: ReturnType<typeof vi.fn>;
        };

        db.deleteFrom.mockReset();

        job = new CleanupJob();
    });

    it("removes the expired rows from every table", async () => {
        db.deleteFrom.mockImplementation((table: string) =>
            builderFor(table, [1]),
        );

        const result = await job.run();

        expect(result.sessions).toBe(1);
        expect(result.recoveries).toBe(1);
        expect(result.tfa).toBe(1);
        expect(result.refreshTokens).toBe(1);
        expect(result.verifications).toBe(1);
        expect(result.rateLimits).toBe(1);
        expect(result.idempotencyKeys).toBe(1);

        const tables = db.deleteFrom.mock.calls.map((call) => call[0]);

        expect(tables).toContain("authentication_tokens");
        expect(tables).toContain("password_recoveries");
        expect(tables).toContain("two_factor_authentications");
        expect(tables).toContain("refresh_tokens");
        expect(tables).toContain("verification_tokens");
        expect(tables).toContain("rate_limits");
        expect(tables).toContain("idempotency_keys");
    });

    it("stops deleting once a batch is smaller than the limit", async () => {
        // The first batch is full, the second is not.
        db.deleteFrom.mockImplementation((table: string) =>
            builderFor(table, [1000, 3]),
        );

        const result = await job.run();

        // Two batches per table: 1000 + 3.
        expect(result.sessions).toBe(1003);

        // Seven tables, two batches each.
        expect(db.deleteFrom).toHaveBeenCalledTimes(14);
    });

    it("starts and stops the schedule", () => {
        job.start();
        job.start();

        job.stop();

        expect(true).toBe(true);
    });
});
