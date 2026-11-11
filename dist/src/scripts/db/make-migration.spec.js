"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const vitest_1 = require("vitest");
const make_migration_1 = require("../../../scripts/db/make-migration");
(0, vitest_1.describe)("make-migration helpers", () => {
    let baseDir;
    (0, vitest_1.beforeEach)(() => {
        baseDir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "make-migration-"));
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(baseDir, { recursive: true, force: true });
    });
    (0, vitest_1.describe)("validateMigrationName", () => {
        (0, vitest_1.it)("accepts a valid snake_case name", () => {
            (0, vitest_1.expect)((0, make_migration_1.validateMigrationName)("add_users")).toBe("add_users");
        });
        (0, vitest_1.it)("rejects an empty name", () => {
            (0, vitest_1.expect)(() => (0, make_migration_1.validateMigrationName)(undefined)).toThrow(/Usage:/);
        });
        (0, vitest_1.it)("rejects names with uppercase or hyphens", () => {
            (0, vitest_1.expect)(() => (0, make_migration_1.validateMigrationName)("Add-Users")).toThrow(/Usage:/);
        });
    });
    (0, vitest_1.describe)("scaffoldMigration", () => {
        (0, vitest_1.it)("creates a migration file under database/migrations", () => {
            const filePath = (0, make_migration_1.scaffoldMigration)("create_posts", baseDir);
            (0, vitest_1.expect)(filePath).toContain(node_path_1.default.join("database", "migrations"));
            (0, vitest_1.expect)(node_path_1.default.basename(filePath)).toMatch(/^\d{14}_create_posts\.ts$/);
            const content = (0, node_fs_1.readFileSync)(filePath, "utf8");
            (0, vitest_1.expect)(content).toContain("export async function up");
            (0, vitest_1.expect)(content).toContain("export async function down");
            (0, vitest_1.expect)(content).not.toContain("TODO");
        });
        (0, vitest_1.it)("throws when an invalid name is provided", () => {
            (0, vitest_1.expect)(() => (0, make_migration_1.scaffoldMigration)("Bad-Name", baseDir)).toThrow(/Usage:/);
        });
    });
});
