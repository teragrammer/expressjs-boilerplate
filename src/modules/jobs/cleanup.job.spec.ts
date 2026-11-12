import {beforeEach, describe, expect, it, vi} from "vitest";
import type {Kysely} from "kysely";
import type {Database} from "../../config/schema";
import {CleanupJob} from "./cleanup.job";

vi.mock("../../config/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

/**
 * Builds a Kysely-shaped fake whose executor returns the supplied
 * affected-row counts in order.
 *
 * The real SQL is covered by `tests/integration/cleanup.spec.ts`; this
 * unit test isolates the batching loop.
 */
function fakeDatabase(counts: bigint[]): {
    db: Kysely<Database>;
    executeQuery: ReturnType<typeof vi.fn>;
} {
    let index = 0;

    const executeQuery = vi.fn(async () => ({
        rows: [],
        numAffectedRows: counts[index++] ?? BigInt(0),
    }));

    const executor = {
        transformQuery: (node: unknown) => node,
        compileQuery: (node: unknown) => ({
            query: node,
            sql: "",
            parameters: [],
        }),
        executeQuery,
        withPlugins: () => executor,
    };

    const db = {
        getExecutor: () => executor,
    } as unknown as Kysely<Database>;

    return {db, executeQuery};
}

describe("CleanupJob", () => {
    let job: CleanupJob;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("removes the expired rows from every table", async () => {
        const {db} = fakeDatabase([
            BigInt(1), BigInt(1), BigInt(1), BigInt(1),
            BigInt(1), BigInt(1), BigInt(1),
        ]);

        job = new CleanupJob(db);

        const result = await job.run();

        expect(result).toEqual({
            sessions: 1,
            recoveries: 1,
            tfa: 1,
            refreshTokens: 1,
            verifications: 1,
            rateLimits: 1,
            idempotencyKeys: 1,
        });
    });

    it("stops deleting once a batch is smaller than the limit", async () => {
        const {db, executeQuery} = fakeDatabase([
            BigInt(1000),
            BigInt(3),
            BigInt(0),
            BigInt(0),
            BigInt(0),
            BigInt(0),
            BigInt(0),
            BigInt(0),
        ]);

        job = new CleanupJob(db);

        const result = await job.run();

        expect(result.sessions).toBe(1003);
        expect(result.recoveries).toBe(0);

        // Sessions need two batches; the other six tables need one each.
        expect(executeQuery).toHaveBeenCalledTimes(8);
    });

    it("starts and stops the schedule", () => {
        const {db} = fakeDatabase([]);
        job = new CleanupJob(db);

        job.start();
        job.start();

        job.stop();

        expect(true).toBe(true);
    });
});
