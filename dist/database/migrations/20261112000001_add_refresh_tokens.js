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
// database/migrations/20261112000001_add_refresh_tokens.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("refresh_tokens")
            .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_random_uuid()`))
            .addColumn("session_id", "integer", (col) => col.notNull())
            .addColumn("user_id", "integer", (col) => col.notNull())
            .addColumn("token_hash", "varchar(128)", (col) => col.notNull().unique())
            .addColumn("family_id", "uuid", (col) => col.notNull())
            .addColumn("expires_at", "timestamptz", (col) => col.notNull())
            .addColumn("revoked_at", "timestamptz")
            .addColumn("replaced_by", "uuid")
            .addColumn("ip", "varchar(100)")
            .addColumn("user_agent", "varchar(255)")
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addForeignKeyConstraint("refresh_tokens_session_id_fk", ["session_id"], "authentication_tokens", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .addForeignKeyConstraint("refresh_tokens_user_id_fk", ["user_id"], "users", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .execute();
        yield db.schema
            .createIndex("idx_refresh_tokens_family_id")
            .on("refresh_tokens")
            .column("family_id")
            .execute();
        yield db.schema
            .createIndex("idx_refresh_tokens_user_id")
            .on("refresh_tokens")
            .column("user_id")
            .execute();
        yield db.schema
            .createIndex("idx_refresh_tokens_expires_at")
            .on("refresh_tokens")
            .column("expires_at")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("refresh_tokens").execute();
    });
}
