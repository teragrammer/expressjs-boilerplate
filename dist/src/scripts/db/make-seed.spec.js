"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const vitest_1 = require("vitest");
const make_seed_1 = require("../../../scripts/db/make-seed");
(0, vitest_1.describe)("make-seed helpers", () => {
    let baseDir;
    (0, vitest_1.beforeEach)(() => {
        baseDir = (0, node_fs_1.mkdtempSync)(node_path_1.default.join((0, node_os_1.tmpdir)(), "make-seed-"));
    });
    (0, vitest_1.afterEach)(() => {
        (0, node_fs_1.rmSync)(baseDir, { recursive: true, force: true });
    });
    (0, vitest_1.describe)("validateSeedName", () => {
        (0, vitest_1.it)("accepts a valid snake_case name", () => {
            (0, vitest_1.expect)((0, make_seed_1.validateSeedName)("seed_posts")).toBe("seed_posts");
        });
        (0, vitest_1.it)("rejects an empty name", () => {
            (0, vitest_1.expect)(() => (0, make_seed_1.validateSeedName)(undefined)).toThrow(/Usage:/);
        });
        (0, vitest_1.it)("rejects names with uppercase or hyphens", () => {
            (0, vitest_1.expect)(() => (0, make_seed_1.validateSeedName)("Seed-Posts")).toThrow(/Usage:/);
        });
    });
    (0, vitest_1.describe)("scaffoldSeed", () => {
        (0, vitest_1.it)("creates a seed file under database/seeds", () => {
            const filePath = (0, make_seed_1.scaffoldSeed)("seed_posts", baseDir);
            (0, vitest_1.expect)(filePath).toContain(node_path_1.default.join("database", "seeds"));
            (0, vitest_1.expect)(node_path_1.default.basename(filePath)).toBe("seed_posts.ts");
            const content = (0, node_fs_1.readFileSync)(filePath, "utf8");
            (0, vitest_1.expect)(content).toContain("export async function seed");
            (0, vitest_1.expect)(content).not.toContain("TODO");
        });
        (0, vitest_1.it)("throws when an invalid name is provided", () => {
            (0, vitest_1.expect)(() => (0, make_seed_1.scaffoldSeed)("Bad-Name", baseDir)).toThrow(/Usage:/);
        });
    });
});
