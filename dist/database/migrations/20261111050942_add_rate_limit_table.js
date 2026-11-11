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
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("rate_limits")
            .addColumn("id", "bigserial", (col) => col.primaryKey())
            .addColumn("key", "varchar(255)", (col) => col.notNull())
            .addColumn("bucket", "varchar(100)", (col) => col.notNull())
            .addColumn("count", "integer", (col) => col.notNull().defaultTo(0))
            .addColumn("expires_at", "timestamptz", (col) => col.notNull())
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .execute();
        // Unique index on key + bucket for atomic upserts
        yield db.schema
            .createIndex("idx_rate_limits_key_bucket")
            .on("rate_limits")
            .columns(["key", "bucket"])
            .unique()
            .execute();
        // Index for cleanup of expired entries
        yield db.schema
            .createIndex("idx_rate_limits_expires_at")
            .on("rate_limits")
            .column("expires_at")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("rate_limits").execute();
    });
}
