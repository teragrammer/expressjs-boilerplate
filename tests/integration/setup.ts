// tests/integration/setup.ts
import {afterAll, beforeAll} from 'vitest';
import {closeDatabase} from "../../src/config/database";
import {migrateToLatest} from "../../src/config/migrator";

// Runs ONCE before any integration test files start
beforeAll(async () => {
    await migrateToLatest();
});

// Runs ONCE after all integration test files have finished
afterAll(async () => {
    await closeDatabase();
});
