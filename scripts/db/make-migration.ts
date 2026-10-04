// scripts/db/make-migration.ts
import fs from "node:fs";
import path from "node:path";

/**
 * Scaffolds a new Kysely migration file.
 *
 * Usage: npm run make:migration -- <name>
 *
 * After scaffolding, register the migration in
 * `src/config/migrator.ts` in timestamp order.
 */
function main(): void {
    const name = process.argv[2];

    if (!name || !/^[a-z0-9_]+$/.test(name)) {
        // eslint-disable-next-line no-console
        console.error("Usage: npm run make:migration -- <snake_case_name>");
        process.exit(1);
    }

    const timestamp = new Date()
        .toISOString()
        .replace(/[-:T.]/g, "")
        .slice(0, 14);

    const fileName = `${timestamp}_${name}.ts`;
    const directory = path.resolve(process.cwd(), "database", "migrations");

    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(
        path.join(directory, fileName),
        `import type {Kysely} from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
    // TODO: implement migration using db.schema
    void db;
}

export async function down(db: Kysely<any>): Promise<void> {
    // TODO: implement rollback using db.schema
    void db;
}
`,
    );

    // eslint-disable-next-line no-console
    console.log(`Created migration: database/migrations/${fileName}`);
    // eslint-disable-next-line no-console
    console.log("Remember to register it in src/config/migrator.ts.");
}

main();
