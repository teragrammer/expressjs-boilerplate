// scripts/db/migrate.ts
import {closeDatabase} from "../../src/config/database";
import {disconnectRedis} from "../../src/config/redis";
import {migrateToLatest} from "../../src/config/migrator";

async function shutdown(code: number): Promise<never> {
    try {
        await closeDatabase();
    } catch {
        // Pool may already be drained; exit code carries the outcome.
    }

    try {
        await disconnectRedis();
    } catch {
        // Redis is optional (database-only fallback mode).
    }

    process.exit(code);
}

async function main(): Promise<void> {
    await migrateToLatest();
    // eslint-disable-next-line no-console
    console.log("All migrations have been executed.");
}

void main().then(
    () => shutdown(0),
    (error: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Migration failed:", error);
        void shutdown(1);
    },
);
