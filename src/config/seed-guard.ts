// src/config/seed-guard.ts
/**
 * Minimum length for an explicitly configured seed password.
 *
 * The value is shared by every seeded development account, so a short
 * password would be the weakest credential in the database.
 */
export const MIN_SEED_PASSWORD_LENGTH = 12;

export interface SeedGuardOptions {
    nodeEnv: string;
    seedPassword: string;
}

/**
 * Refuses unsafe seed runs before any row is written.
 *
 * Seeding is a development/bootstrap operation: production accounts must
 * be created through the normal administrative flow and must never inherit
 * a shared password from a deployment environment file.
 */
export function assertSeedingAllowed(options: SeedGuardOptions): void {
    const errors: string[] = [];

    if (options.nodeEnv === "production") {
        errors.push(
            "database seeding is disabled in production; use a one-time maintenance procedure",
        );
    }

    if (!options.seedPassword) {
        errors.push("SEED_PASSWORD must be set explicitly");
    } else if (options.seedPassword.length < MIN_SEED_PASSWORD_LENGTH) {
        errors.push(
            `SEED_PASSWORD must be at least ${MIN_SEED_PASSWORD_LENGTH} characters`,
        );
    }

    if (errors.length > 0) {
        throw new Error(`Refusing to seed users: ${errors.join("; ")}`);
    }
}
