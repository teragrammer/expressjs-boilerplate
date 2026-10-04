// scripts/db/make-seed.ts
import fs from "node:fs";
import path from "node:path";

/**
 * Scaffolds a new Kysely seed file.
 *
 * Usage: npm run make:seed -- <name>
 *
 * After scaffolding, wire the seed into `scripts/db/seed.ts`
 * in dependency order.
 */
function main(): void {
    const name = process.argv[2];

    if (!name || !/^[a-z0-9_]+$/.test(name)) {
        // eslint-disable-next-line no-console
        console.error("Usage: npm run make:seed -- <snake_case_name>");
        process.exit(1);
    }

    const fileName = `${name}.ts`;
    const directory = path.resolve(process.cwd(), "database", "seeds");

    fs.mkdirSync(directory, {recursive: true});
    fs.writeFileSync(
        path.join(directory, fileName),
        `import type {Kysely} from "kysely";
import type {Database} from "../../src/config/schema";

export async function seed(db: Kysely<Database>): Promise<void> {
    // TODO: implement seeder using db.insertInto(...)
    void db;
}
`,
    );

    // eslint-disable-next-line no-console
    console.log(`Created seeder: database/seeds/${fileName}`);
    // eslint-disable-next-line no-console
    console.log("Remember to wire it into scripts/db/seed.ts.");
}

main();
