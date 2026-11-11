"use strict";
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
exports.up = up;
exports.down = down;
// database/migrations/20261112000007_add_trigram_search_indexes.ts
const kysely_1 = require("kysely");
/**
 * Trigram search indexes.
 *
 * `pg_trgm` enables GIN indexes for leading-wildcard search
 * (`LIKE '%term%'`), which a plain B-tree index cannot support.
 *
 * The search columns are concatenated into a single expression so one
 * index covers the multi-column search predicate.
 *
 * NOTE: Kysely runs each migration inside a transaction, and
 * `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.
 * The indexes are therefore created non-concurrently. For a large
 * production table, apply the equivalent statements manually with
 * `CREATE INDEX CONCURRENTLY` during a maintenance window before
 * enabling the feature (see docs/runbooks/migrations.md).
 */
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, kysely_1.sql) `CREATE EXTENSION IF NOT EXISTS pg_trgm;`.execute(db);
        yield (0, kysely_1.sql) `
        CREATE INDEX IF NOT EXISTS idx_users_search_trgm
        ON users USING gin (
            (coalesce(first_name, '') || ' ' ||
             coalesce(middle_name, '') || ' ' ||
             coalesce(last_name, '') || ' ' ||
             coalesce(username, '') || ' ' ||
             coalesce(email, '') || ' ' ||
             coalesce(phone, '')) gin_trgm_ops
        )
    `.execute(db);
        yield (0, kysely_1.sql) `
        CREATE INDEX IF NOT EXISTS idx_roles_search_trgm
        ON roles USING gin (
            (coalesce(name, '') || ' ' ||
             coalesce(slug, '') || ' ' ||
             coalesce(description, '')) gin_trgm_ops
        )
    `.execute(db);
        yield (0, kysely_1.sql) `
        CREATE INDEX IF NOT EXISTS idx_settings_search_trgm
        ON settings USING gin (
            (coalesce(name, '') || ' ' ||
             coalesce(slug, '') || ' ' ||
             coalesce(description, '')) gin_trgm_ops
        )
    `.execute(db);
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, kysely_1.sql) `DROP INDEX IF EXISTS idx_settings_search_trgm;`.execute(db);
        yield (0, kysely_1.sql) `DROP INDEX IF EXISTS idx_roles_search_trgm;`.execute(db);
        yield (0, kysely_1.sql) `DROP INDEX IF EXISTS idx_users_search_trgm;`.execute(db);
    });
}
