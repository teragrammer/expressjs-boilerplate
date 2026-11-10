// scripts/db/make-migration.ts
import fs from "node:fs";
import path from "node:path";

/**
 * Validates a migration name.
 *
 * Migration names must be non-empty snake_case identifiers so the
 * generated file name stays sortable and filesystem-safe.
 */
export function validateMigrationName(name: string | undefined): string {
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
export function scaffoldMigration(
    name: string,
    baseDir: string = process.cwd(),
): string {
    const validName = validateMigrationName(name);

    const timestamp = new Date()
        .toISOString()
        .replace(/[-:T.]/g, "")
        .slice(0, 14);

    const fileName = `${timestamp}_${validName}.ts`;
    const directory = path.resolve(baseDir, "database", "migrations");
    const filePath = path.join(directory, fileName);

    if (fs.existsSync(filePath)) {
        throw new Error(`Migration already exists: ${path.relative(baseDir, filePath)}`);
    }

    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(
        filePath,
        `import type {Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    void db;
}

export async function down(db: Kysely<any>): Promise<void> {
    void db;
}
`,
    );

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
export function main(): void {
    try {
        const filePath = scaffoldMigration(process.argv[2]);
        // eslint-disable-next-line no-console
        console.log(`Created migration: ${path.relative(process.cwd(), filePath)}`);
        // eslint-disable-next-line no-console
        console.log("Remember to register it in src/config/migrator.ts.");
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // eslint-disable-next-line no-console
        console.error(message);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}