// scripts/db/make-seed.ts
import fs from "node:fs";
import path from "node:path";

/**
 * Validates a seed name.
 *
 * Seed names must be non-empty snake_case identifiers so the generated
 * file name stays filesystem-safe.
 */
export function validateSeedName(name: string | undefined): string {
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
export function scaffoldSeed(
    name: string,
    baseDir: string = process.cwd(),
): string {
    const validName = validateSeedName(name);

    const fileName = `${validName}.ts`;
    const directory = path.resolve(baseDir, "database", "seeds");
    const filePath = path.join(directory, fileName);

    if (fs.existsSync(filePath)) {
        throw new Error(`Seed already exists: ${path.relative(baseDir, filePath)}`);
    }

    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(
        filePath,
        `import type {Kysely} from "kysely";
import type {Database} from "../../src/config/schema";

export async function seed(db: Kysely<Database>): Promise<void> {
    void db;
}
`,
    );

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
export function main(): void {
    try {
        const filePath = scaffoldSeed(process.argv[2]);
        // eslint-disable-next-line no-console
        console.log(`Created seeder: ${path.relative(process.cwd(), filePath)}`);
        // eslint-disable-next-line no-console
        console.log("Remember to wire it into scripts/db/seed.ts.");
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