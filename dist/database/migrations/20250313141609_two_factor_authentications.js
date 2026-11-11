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
// database/migrations/20250313141609_two_factor_authentications.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("two_factor_authentications")
            .addColumn("id", "bigserial", (col) => col.primaryKey())
            .addColumn("token_id", "bigint", (col) => col.notNull().unique())
            .addColumn("code", "varchar(60)", (col) => col.notNull())
            .addColumn("tries", "integer", (col) => col.notNull().defaultTo(0))
            .addColumn("next_send_at", "timestamptz")
            .addColumn("expired_tries_at", "timestamptz")
            .addColumn("expired_at", "timestamptz")
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addForeignKeyConstraint("two_factor_authentications_token_id_fk", ["token_id"], "authentication_tokens", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .execute();
        yield db.schema
            .createIndex("idx_2fa_token_expiration")
            .on("two_factor_authentications")
            .columns(["token_id", "expired_at"])
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("two_factor_authentications").execute();
    });
}
