// tests/integration/helpers.ts
/**
 * Test helpers shared by the integration suites.
 */

/**
 * Drains the outbox queue.
 *
 * Background jobs are processed by a worker in production. Tests call
 * this helper to run the pending events deterministically instead of
 * waiting for the polling interval.
 *
 * The container is imported lazily: importing it at module load would
 * pull the real mail provider into the module registry before a test
 * file can install its own mock.
 */
export async function drainOutbox(): Promise<void> {
    const {outboxWorker} = await import("../../src/config/container");

    for (let i = 0; i < 10; i += 1) {
        const processed = await outboxWorker.tick();

        if (processed === 0) {
            return;
        }
    }
}
