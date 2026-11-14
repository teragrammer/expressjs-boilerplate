// src/config/migrator.ts
import type {Kysely} from "kysely";
import {Migrator, type Migration, type MigrationProvider} from "kysely/migration";
import {db} from "./database";
import type {Database} from "./schema";

import * as settings from "../../database/migrations/20250313141523_create_settings_table";
import * as roles from "../../database/migrations/20250313141537_create_roles_table";
import * as users from "../../database/migrations/20250313141544_create_users_table";
import * as authenticationTokens from "../../database/migrations/20250313141555_create_authentication_tokens_table";
import * as twoFactorAuthentications from "../../database/migrations/20250313141609_create_two_factor_authentications_table";
import * as passwordRecoveries from "../../database/migrations/20250511063013_create_password_recoveries_table";
import * as routeGuards from "../../database/migrations/20251023075024_create_route_guards_table";
import * as addRateLimitTable from "../../database/migrations/20261111050942_create_rate_limits_table";
import * as addRefreshTokens from "../../database/migrations/20261112000001_create_refresh_tokens_table";
import * as addVerificationTokens from "../../database/migrations/20261112000002_create_verification_tokens_table";
import * as addAuditLogs from "../../database/migrations/20261112000003_create_audit_logs_table";
import * as addOutboxEvents from "../../database/migrations/20261112000004_create_outbox_events_table";
import * as addIdempotencyKeys from "../../database/migrations/20261112000005_create_idempotency_keys_table";
import * as addTfaStateAndRecoveryCodes from "../../database/migrations/20261112000010_create_tfa_recovery_codes_table";
import * as addVerificationStateColumns from "../../database/migrations/20261114000001_add_verification_state_columns";

/**
 * Ordered migration registry.
 *
 * A static registry (instead of filesystem discovery) keeps migrations
 * working identically under ts-node, vitest, and compiled `dist` output,
 * and makes every schema change an explicit, reviewable diff.
 *
 * When adding a migration: create the file under `database/migrations`
 * (see `npm run make:migration`) and register it here in timestamp order.
 *
 * Naming convention (required): YYYYMMDDHHmmss_descriptive_action_and_table.ts
 * Example: 20261111120000_create_users_table.ts
 */
const MIGRATIONS: Array<[string, Migration]> = [
    ["20250313141523_create_settings_table", settings],
    ["20250313141537_create_roles_table", roles],
    ["20250313141544_create_users_table", users],
    ["20250313141555_create_authentication_tokens_table", authenticationTokens],
    ["20250313141609_create_two_factor_authentications_table", twoFactorAuthentications],
    ["20250511063013_create_password_recoveries_table", passwordRecoveries],
    ["20251023075024_create_route_guards_table", routeGuards],
    ["20261111050942_create_rate_limits_table", addRateLimitTable],
    ["20261112000001_create_refresh_tokens_table", addRefreshTokens],
    ["20261112000002_create_verification_tokens_table", addVerificationTokens],
    ["20261112000003_create_audit_logs_table", addAuditLogs],
    ["20261112000004_create_outbox_events_table", addOutboxEvents],
    ["20261112000005_create_idempotency_keys_table", addIdempotencyKeys],
    ["20261112000010_create_tfa_recovery_codes_table", addTfaStateAndRecoveryCodes],
    ["20261114000001_add_verification_state_columns", addVerificationStateColumns],
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
