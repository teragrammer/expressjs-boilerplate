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
// database/migrations/20261112000002_add_verification_tokens.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("verification_tokens")
            .addColumn("id", "uuid", (col) => col.primaryKey().defaultTo((0, kysely_1.sql) `gen_random_uuid()`))
            .addColumn("user_id", "integer", (col) => col.notNull())
            .addColumn("channel", "varchar(20)", (col) => col.notNull())
            .addColumn("target", "varchar(180)", (col) => col.notNull())
            .addColumn("token_hash", "varchar(128)", (col) => col.notNull().unique())
            .addColumn("expires_at", "timestamptz", (col) => col.notNull())
            .addColumn("consumed_at", "timestamptz")
            .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addCheckConstraint("verification_tokens_channel_check", (0, kysely_1.sql) `channel in ('email', 'phone')`)
            .addForeignKeyConstraint("verification_tokens_user_id_fk", ["user_id"], "users", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .execute();
        yield db.schema
            .createIndex("idx_verification_tokens_user_channel")
            .on("verification_tokens")
            .columns(["user_id", "channel"])
            .execute();
        yield db.schema
            .createIndex("idx_verification_tokens_expires_at")
            .on("verification_tokens")
            .column("expires_at")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("verification_tokens").execute();
    });
}
