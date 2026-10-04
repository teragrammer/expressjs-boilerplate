// scripts/db/seed.ts
import {closeDatabase, db} from "../../src/config/database";
import {disconnectRedis} from "../../src/config/redis";
import {seed as seedSettings} from "../../database/seeds/settings";
import {seed as seedUsers} from "../../database/seeds/users";

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
    await seedSettings(db);
    await seedUsers(db);
    // eslint-disable-next-line no-console
    console.log("All seeders have been executed.");
}

void main().then(
    () => shutdown(0),
    (error: unknown) => {
        // eslint-disable-next-line no-console
        console.error("Seeding failed:", error);
        void shutdown(1);
    },
);
