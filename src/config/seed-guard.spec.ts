// src/config/seed-guard.spec.ts
import {describe, expect, it} from "vitest";

import {
    assertSeedingAllowed,
    MIN_SEED_PASSWORD_LENGTH,
} from "./seed-guard";

describe("assertSeedingAllowed", () => {
    it("accepts a development seed with an explicit password", () => {
        expect(() =>
            assertSeedingAllowed({
                nodeEnv: "development",
                seedPassword: "a".repeat(MIN_SEED_PASSWORD_LENGTH),
            }),
        ).not.toThrow();
    });

    it("refuses to seed in production", () => {
        expect(() =>
            assertSeedingAllowed({
                nodeEnv: "production",
                seedPassword: "a".repeat(MIN_SEED_PASSWORD_LENGTH),
            }),
        ).toThrowError(/seeding is disabled in production/);
    });

    it("requires an explicit seed password", () => {
        expect(() =>
            assertSeedingAllowed({
                nodeEnv: "development",
                seedPassword: "",
            }),
        ).toThrowError(/SEED_PASSWORD must be set explicitly/);
    });

    it("rejects a short seed password", () => {
        expect(() =>
            assertSeedingAllowed({
                nodeEnv: "development",
                seedPassword: "short",
            }),
        ).toThrowError(/SEED_PASSWORD must be at least/);
    });
});
