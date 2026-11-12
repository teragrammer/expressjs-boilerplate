// tests/integration/system/cleanup.spec.ts
import {randomUUID} from "node:crypto";
import {describe, expect, it} from "vitest";
import {db} from "../../../src/config/database";
import {CleanupJob} from "../../../src/modules/jobs/cleanup.job";

/**
 * Regression coverage for the cleanup job.
 *
 * The original unit test mocked Kysely's `.limit()` and therefore never
 * executed the generated SQL. PostgreSQL does not support
 * `DELETE ... LIMIT`, so the job failed at runtime. This test exercises
 * the real database and verifies that expired rows are actually
 * removed.
 */
describe("CleanupJob (PostgreSQL)", () => {
    it("deletes expired rows without a SQL syntax error", async () => {
        const suffix = randomUUID();
        const now = new Date();
        const expired = new Date(now.getTime() - 60_000);

        const rateLimitKey = `cleanup-test-${suffix}`;
        const recoveryTarget = `cleanup-${suffix}@example.com`;

        await db
            .insertInto("rate_limits")
            .values({
                key: rateLimitKey,
                bucket: "cleanup-test",
                count: 1,
                expires_at: expired,
            })
            .execute();

        await db
            .insertInto("password_recoveries")
            .values({
                type: "email",
                send_to: recoveryTarget,
                code: "hash",
                next_resend_at: expired,
                expired_at: expired,
                tries: 0,
                user_id: null,
            })
            .execute();

        const job = new CleanupJob();
        const result = await job.run();

        expect(result.rateLimits).toBeGreaterThanOrEqual(1);
        expect(result.recoveries).toBeGreaterThanOrEqual(1);

        const rateLimitRow = await db
            .selectFrom("rate_limits")
            .select("id")
            .where("key", "=", rateLimitKey)
            .executeTakeFirst();

        const recoveryRow = await db
            .selectFrom("password_recoveries")
            .select("id")
            .where("send_to", "=", recoveryTarget)
            .executeTakeFirst();

        expect(rateLimitRow).toBeUndefined();
        expect(recoveryRow).toBeUndefined();
    });
});
