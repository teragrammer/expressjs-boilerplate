"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createMigrator = createMigrator;
exports.migrateToLatest = migrateToLatest;
const migration_1 = require("kysely/migration");
const database_1 = require("./database");
const settings = __importStar(require("../../database/migrations/20250313141523_settings"));
const roles = __importStar(require("../../database/migrations/20250313141537_roles"));
const users = __importStar(require("../../database/migrations/20250313141544_users"));
const authenticationTokens = __importStar(require("../../database/migrations/20250313141555_authentication_tokens"));
const twoFactorAuthentications = __importStar(require("../../database/migrations/20250313141609_two_factor_authentications"));
const passwordRecoveries = __importStar(require("../../database/migrations/20250511063013_password_recoveries"));
const routeGuards = __importStar(require("../../database/migrations/20251023075024_route_guards"));
const changeFkUsersRoles = __importStar(require("../../database/migrations/20261111042541_change_fk_to_restrict_users_roles"));
const changeFkAuthTokens = __importStar(require("../../database/migrations/20261111042557_change_fk_to_restrict_auth_tokens"));
const changeFk2fa = __importStar(require("../../database/migrations/20261111042610_change_fk_to_restrict_2fa"));
const changeFkRouteGuards = __importStar(require("../../database/migrations/20261111042618_change_fk_to_restrict_route_guards"));
const addAuthVersion = __importStar(require("../../database/migrations/20261111042626_add_authorization_version_to_users"));
const makeExpiredAtNotNull = __importStar(require("../../database/migrations/20261111042635_make_expired_at_not_null_auth_tokens"));
const addRateLimitTable = __importStar(require("../../database/migrations/20261111050942_add_rate_limit_table"));
const addRefreshTokens = __importStar(require("../../database/migrations/20261112000001_add_refresh_tokens"));
const addVerificationTokens = __importStar(require("../../database/migrations/20261112000002_add_verification_tokens"));
const addAuditLogs = __importStar(require("../../database/migrations/20261112000003_add_audit_logs"));
const addOutboxEvents = __importStar(require("../../database/migrations/20261112000004_add_outbox_events"));
const addIdempotencyKeys = __importStar(require("../../database/migrations/20261112000005_add_idempotency_keys"));
const addRouteGuardIntegrity = __importStar(require("../../database/migrations/20261112000006_add_route_guards_integrity"));
const addTrigramIndexes = __importStar(require("../../database/migrations/20261112000007_add_trigram_search_indexes"));
const addBrowseIndexes = __importStar(require("../../database/migrations/20261112000008_add_settings_roles_browse_indexes"));
const addRecoveryUserId = __importStar(require("../../database/migrations/20261112000009_add_user_id_to_password_recoveries"));
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
const MIGRATIONS = [
    ["20250313141523_settings", settings],
    ["20250313141537_roles", roles],
    ["20250313141544_users", users],
    ["20250313141555_authentication_tokens", authenticationTokens],
    ["20250313141609_two_factor_authentications", twoFactorAuthentications],
    ["20250511063013_password_recoveries", passwordRecoveries],
    ["20251023075024_route_guards", routeGuards],
    ["20261111042541_change_fk_to_restrict_users_roles", changeFkUsersRoles],
    ["20261111042557_change_fk_to_restrict_auth_tokens", changeFkAuthTokens],
    ["20261111042610_change_fk_to_restrict_2fa", changeFk2fa],
    ["20261111042618_change_fk_to_restrict_route_guards", changeFkRouteGuards],
    ["20261111042626_add_authorization_version_to_users", addAuthVersion],
    ["20261111042635_make_expired_at_not_null_auth_tokens", makeExpiredAtNotNull],
    ["20261111050942_add_rate_limit_table", addRateLimitTable],
    ["20261112000001_add_refresh_tokens", addRefreshTokens],
    ["20261112000002_add_verification_tokens", addVerificationTokens],
    ["20261112000003_add_audit_logs", addAuditLogs],
    ["20261112000004_add_outbox_events", addOutboxEvents],
    ["20261112000005_add_idempotency_keys", addIdempotencyKeys],
    ["20261112000006_add_route_guards_integrity", addRouteGuardIntegrity],
    ["20261112000007_add_trigram_search_indexes", addTrigramIndexes],
    ["20261112000008_add_settings_roles_browse_indexes", addBrowseIndexes],
    ["20261112000009_add_user_id_to_password_recoveries", addRecoveryUserId],
];
class StaticMigrationProvider {
    getMigrations() {
        return __awaiter(this, void 0, void 0, function* () {
            return Object.fromEntries(MIGRATIONS);
        });
    }
}
function createMigrator(dbInstance = database_1.db) {
    return new migration_1.Migrator({
        db: dbInstance,
        provider: new StaticMigrationProvider(),
    });
}
/**
 * Applies all pending migrations. Used by the `db:migrate` script
 * and the integration-test setup.
 */
function migrateToLatest() {
    return __awaiter(this, arguments, void 0, function* (dbInstance = database_1.db) {
        const migrator = createMigrator(dbInstance);
        const { error, results } = yield migrator.migrateToLatest();
        for (const result of results !== null && results !== void 0 ? results : []) {
            if (result.status === "Success") {
                // eslint-disable-next-line no-console
                console.log(`Migration "${result.migrationName}" executed successfully.`);
            }
            else if (result.status === "Error") {
                // eslint-disable-next-line no-console
                console.error(`Failed to execute migration "${result.migrationName}".`);
            }
        }
        if (error) {
            throw error;
        }
    });
}
