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
// database/migrations/20261112000005_add_idempotency_keys.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("idempotency_keys")
            .addColumn("id", "bigserial", (col) => col.primaryKey())
            .addColumn("key", "varchar(255)", (col) => col.notNull())
            .addColumn("user_id", "integer")
            .addColumn("route", "varchar(255)", (col) => col.notNull())
            .addColumn("request_hash", "varchar(128)", (col) => col.notNull())
            .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("in_progress"))
            .addColumn("response_status", "integer")
            .addColumn("response_body", "jsonb")
            .addColumn("locked_at", "timestamptz")
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("expires_at", "timestamptz", (col) => col.notNull())
            .addCheckConstraint("idempotency_keys_status_check", (0, kysely_1.sql) `status in ('in_progress', 'completed')`)
            .execute();
        yield db.schema
            .createIndex("idx_idempotency_keys_key_route_user")
            .on("idempotency_keys")
            .columns(["key", "route", "user_id"])
            .unique()
            .execute();
        yield db.schema
            .createIndex("idx_idempotency_keys_expires_at")
            .on("idempotency_keys")
            .column("expires_at")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("idempotency_keys").execute();
    });
}
