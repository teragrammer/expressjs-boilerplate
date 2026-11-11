// tests/integration/setup.ts
import {afterAll, beforeAll} from 'vitest';
import {closeDatabase} from "../../src/config/database";
import {migrateToLatest} from "../../src/config/migrator";
import {rateLimitControl} from "../../src/common/middleware/rate-limiter.middleware";

// Runs ONCE before any integration test files start
beforeAll(async () => {
    await migrateToLatest();

    /*
     * The rate limiter is disabled for the suite by default: the
     * limits are shared per IP, so an unrelated test could otherwise
     * trip them.
     *
     * The regression suite enables them explicitly to verify that the
     * limits are actually enforced.
     */
    rateLimitControl.enabled = false;
});

// Runs ONCE after all integration test files have finished
afterAll(async () => {
    await closeDatabase();
});
