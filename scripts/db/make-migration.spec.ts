import {mkdtempSync, readFileSync, rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {afterEach, beforeEach, describe, expect, it} from "vitest";
import {
    scaffoldMigration,
    validateMigrationName,
} from "./make-migration";

describe("make-migration helpers", () => {
    let baseDir: string;

    beforeEach(() => {
        baseDir = mkdtempSync(path.join(tmpdir(), "make-migration-"));
    });

    afterEach(() => {
        rmSync(baseDir, {recursive: true, force: true});
    });

    describe("validateMigrationName", () => {
        it("accepts a valid snake_case name", () => {
            expect(validateMigrationName("add_users")).toBe("add_users");
        });

        it("rejects an empty name", () => {
            expect(() => validateMigrationName(undefined)).toThrow(/Usage:/);
        });

        it("rejects names with uppercase or hyphens", () => {
            expect(() => validateMigrationName("Add-Users")).toThrow(/Usage:/);
        });
    });

    describe("scaffoldMigration", () => {
        it("creates a migration file under database/migrations", () => {
            const filePath = scaffoldMigration("create_posts", baseDir);

            expect(filePath).toContain(path.join("database", "migrations"));
            expect(path.basename(filePath)).toMatch(/^\d{14}_create_posts\.ts$/);

            const content = readFileSync(filePath, "utf8") as string;
            expect(content).toContain("export async function up");
            expect(content).toContain("export async function down");
            expect(content).not.toContain("TODO");
        });

        it("throws when an invalid name is provided", () => {
            expect(() => scaffoldMigration("Bad-Name", baseDir)).toThrow(/Usage:/);
        });
    });
});