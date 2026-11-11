// src/common/utils/single-flight.ts
/**
 * Coalesces concurrent calls that perform the same work.
 *
 * Without it, a cache miss on a hot key makes every waiting worker
 * query the database at once (a cache stampede). The first caller
 * performs the work; the others await the same promise.
 */
export class SingleFlight {
    private readonly inFlight = new Map<string, Promise<unknown>>();

    /**
     * Runs `work` unless an identical call is already in progress.
     */
    async run<T>(key: string, work: () => Promise<T>): Promise<T> {
        const existing = this.inFlight.get(key);

        if (existing) {
            return existing as Promise<T>;
        }

        const promise = (async () => work())().finally(() => {
            this.inFlight.delete(key);
        });

        this.inFlight.set(key, promise);

        return promise;
    }

    /**
     * The number of calls currently in progress.
     */
    get size(): number {
        return this.inFlight.size;
    }
}
