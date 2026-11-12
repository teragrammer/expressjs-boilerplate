import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {scaffoldSeed, validateSeedName} from "./make-seed";

describe("make-seed helpers", () => {
    let baseDir: string;

    beforeEach(() => {
        baseDir = mkdtempSync(path.join(tmpdir(), "make-seed-"));
    });

    afterEach(() => {
        rmSync(baseDir, {recursive: true, force: true});
    });

    describe("validateSeedName", () => {
        it("accepts a valid snake_case name", () => {
            expect(validateSeedName("seed_posts")).toBe("seed_posts");
        });

        it("rejects an empty name", () => {
            expect(() => validateSeedName(undefined)).toThrow(/Usage:/);
        });

        it("rejects names with uppercase or hyphens", () => {
            expect(() => validateSeedName("Seed-Posts")).toThrow(/Usage:/);
        });
    });

    describe("scaffoldSeed", () => {
        it("creates a seed file under database/seeds", () => {
            const filePath = scaffoldSeed("seed_posts", baseDir);

            expect(filePath).toContain(path.join("database", "seeds"));
            expect(path.basename(filePath)).toBe("seed_posts.ts");

            const content = readFileSync(filePath, "utf8") as string;
            expect(content).toContain("export async function seed");
            expect(content).not.toContain("TODO");
        });

        it("throws when an invalid name is provided", () => {
            expect(() => scaffoldSeed("Bad-Name", baseDir)).toThrow(/Usage:/);
        });
    });
});