// src/config/migrator.ts
import type {Kysely} from "kysely";
import {Migrator, type Migration, type MigrationProvider} from "kysely/migration";
import {db} from "./database";
import type {Database} from "./schema";

import * as settings from "../../database/migrations/20250313141523_settings";
import * as roles from "../../database/migrations/20250313141537_roles";
import * as users from "../../database/migrations/20250313141544_users";
import * as authenticationTokens from "../../database/migrations/20250313141555_authentication_tokens";
import * as twoFactorAuthentications from "../../database/migrations/20250313141609_two_factor_authentications";
import * as passwordRecoveries from "../../database/migrations/20250511063013_password_recoveries";
import * as routeGuards from "../../database/migrations/20251023075024_route_guards";
import * as addRateLimitTable from "../../database/migrations/20261111050942_add_rate_limit_table";
import * as addRefreshTokens from "../../database/migrations/20261112000001_add_refresh_tokens";
import * as addVerificationTokens from "../../database/migrations/20261112000002_add_verification_tokens";
import * as addAuditLogs from "../../database/migrations/20261112000003_add_audit_logs";
import * as addOutboxEvents from "../../database/migrations/20261112000004_add_outbox_events";
import * as addIdempotencyKeys from "../../database/migrations/20261112000005_add_idempotency_keys";
import * as addTfaStateAndRecoveryCodes from "../../database/migrations/20261112000010_add_tfa_session_state_and_recovery_codes";

/**
 * Ordered migration registry.
 *
 * A static registry (instead of filesystem discovery) keeps migrations
 * working identically under ts-node, vitest, and compiled `dist` output,
 * and makes every schema change an explicit, reviewable diff.
 *
 * When adding a migration: create the file under `database/migrations`
 * (see `npm run make:migration`) and register it here in timestamp order.
 */
const MIGRATIONS: Array<[string, Migration]> = [
    ["20250313141523_settings", settings],
    ["20250313141537_roles", roles],
    ["20250313141544_users", users],
    ["20250313141555_authentication_tokens", authenticationTokens],
    ["20250313141609_two_factor_authentications", twoFactorAuthentications],
    ["20250511063013_password_recoveries", passwordRecoveries],
    ["20251023075024_route_guards", routeGuards],
    ["20261111050942_add_rate_limit_table", addRateLimitTable],
    ["20261112000001_add_refresh_tokens", addRefreshTokens],
    ["20261112000002_add_verification_tokens", addVerificationTokens],
    ["20261112000003_add_audit_logs", addAuditLogs],
    ["20261112000004_add_outbox_events", addOutboxEvents],
    ["20261112000005_add_idempotency_keys", addIdempotencyKeys],
    ["20261112000010_add_tfa_session_state_and_recovery_codes", addTfaStateAndRecoveryCodes],
];

class StaticMigrationProvider implements MigrationProvider {
    async getMigrations(): Promise<Record<string, Migration>> {
        return Object.fromEntries(MIGRATIONS);
    }
}

export function createMigrator(dbInstance: Kysely<Database> = db): Migrator {
    return new Migrator({
        db: dbInstance,
        provider: new StaticMigrationProvider(),
    });
}

/**
 * Applies all pending migrations. Used by the `db:migrate` script
 * and the integration-test setup.
 */
export async function migrateToLatest(
    dbInstance: Kysely<Database> = db,
): Promise<void> {
    const migrator = createMigrator(dbInstance);
    const {error, results} = await migrator.migrateToLatest();

    for (const result of results ?? []) {
        if (result.status === "Success") {
            // eslint-disable-next-line no-console
            console.log(`Migration "${result.migrationName}" executed successfully.`);
        } else if (result.status === "Error") {
            // eslint-disable-next-line no-console
            console.error(`Failed to execute migration "${result.migrationName}".`);
        }
    }

    if (error) {
        throw error;
    }
}
