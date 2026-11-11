"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateMigrationName = validateMigrationName;
exports.scaffoldMigration = scaffoldMigration;
exports.main = main;
// scripts/db/make-migration.ts
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
/**
 * Validates a migration name.
 *
 * Migration names must be non-empty snake_case identifiers so the
 * generated file name stays sortable and filesystem-safe.
 */
function validateMigrationName(name) {
    if (!name || !/^[a-z0-9_]+$/.test(name)) {
        throw new Error("Usage: npm run make:migration -- <snake_case_name>");
    }
    return name;
}
/**
 * Scaffolds a new Kysely migration file.
 *
 * @param name - Snake-case migration name.
 * @param baseDir - Project root used to resolve the migrations directory.
 *   Defaults to the current working directory.
 * @returns The absolute path of the created migration file.
 */
function scaffoldMigration(name, baseDir = process.cwd()) {
    const validName = validateMigrationName(name);
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:T.]/g, "")
        .slice(0, 14);
    const fileName = `${timestamp}_${validName}.ts`;
    const directory = node_path_1.default.resolve(baseDir, "database", "migrations");
    const filePath = node_path_1.default.join(directory, fileName);
    if (node_fs_1.default.existsSync(filePath)) {
        throw new Error(`Migration already exists: ${node_path_1.default.relative(baseDir, filePath)}`);
    }
    node_fs_1.default.mkdirSync(directory, { recursive: true });
    node_fs_1.default.writeFileSync(filePath, `import type {Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    void db;
}

export async function down(db: Kysely<any>): Promise<void> {
    void db;
}
`);
    return filePath;
}
/**
 * Scaffolds a new Kysely migration file.
 *
 * Usage: npm run make:migration -- <name>
 *
 * After scaffolding, register the migration in
 * `src/config/migrator.ts` in timestamp order.
 */
function main() {
    try {
        const filePath = scaffoldMigration(process.argv[2]);
        // eslint-disable-next-line no-console
        console.log(`Created migration: ${node_path_1.default.relative(process.cwd(), filePath)}`);
        // eslint-disable-next-line no-console
        console.log("Remember to register it in src/config/migrator.ts.");
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
