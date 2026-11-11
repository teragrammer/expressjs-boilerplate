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
// database/migrations/20261112000008_add_settings_roles_browse_indexes.ts
const kysely_1 = require("kysely");
/**
 * Browse indexes for the admin tables.
 *
 * See migration 20261112000007 for why these are not created with
 * `CONCURRENTLY`.
 */
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, kysely_1.sql) `
        CREATE INDEX IF NOT EXISTS idx_settings_browse
        ON settings (is_disabled, is_public, id)
    `.execute(db);
        yield (0, kysely_1.sql) `
        CREATE INDEX IF NOT EXISTS idx_roles_browse
        ON roles (is_public, id)
    `.execute(db);
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, kysely_1.sql) `DROP INDEX IF EXISTS idx_roles_browse;`.execute(db);
        yield (0, kysely_1.sql) `DROP INDEX IF EXISTS idx_settings_browse;`.execute(db);
    });
}
