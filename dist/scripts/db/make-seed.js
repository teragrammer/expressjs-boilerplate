"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateSeedName = validateSeedName;
exports.scaffoldSeed = scaffoldSeed;
exports.main = main;
// scripts/db/make-seed.ts
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * Validates a seed name.
 *
 * Seed names must be non-empty snake_case identifiers so the generated
 * file name stays filesystem-safe.
 */
function validateSeedName(name) {
    if (!name || !/^[a-z0-9_]+$/.test(name)) {
        throw new Error("Usage: npm run make:seed -- <snake_case_name>");
    }
    return name;
}
/**
 * Scaffolds a new Kysely seed file.
 *
 * @param name - Snake-case seed name.
 * @param baseDir - Project root used to resolve the seeds directory.
 *   Defaults to the current working directory.
 * @returns The absolute path of the created seed file.
 */
function scaffoldSeed(name, baseDir = process.cwd()) {
    const validName = validateSeedName(name);
    const fileName = `${validName}.ts`;
    const directory = node_path_1.default.resolve(baseDir, "database", "seeds");
    const filePath = node_path_1.default.join(directory, fileName);
    if (node_fs_1.default.existsSync(filePath)) {
        throw new Error(`Seed already exists: ${node_path_1.default.relative(baseDir, filePath)}`);
    }
    node_fs_1.default.mkdirSync(directory, { recursive: true });
    node_fs_1.default.writeFileSync(filePath, `import type {Kysely} from "kysely";
import type {Database} from "../../src/config/schema";

export async function seed(db: Kysely<Database>): Promise<void> {
    void db;
}
`);
    return filePath;
}
/**
 * Scaffolds a new Kysely seed file.
 *
 * Usage: npm run make:seed -- <name>
 *
 * After scaffolding, wire the seed into `scripts/db/seed.ts`
 * in dependency order.
 */
function main() {
    try {
        const filePath = scaffoldSeed(process.argv[2]);
        // eslint-disable-next-line no-console
        console.log(`Created seeder: ${node_path_1.default.relative(process.cwd(), filePath)}`);
        // eslint-disable-next-line no-console
        console.log("Remember to wire it into scripts/db/seed.ts.");
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(message);
        process.exit(1);
    }
}
if (require.main === module) {
    main();
}
