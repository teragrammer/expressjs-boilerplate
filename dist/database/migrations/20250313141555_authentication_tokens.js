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
// database/migrations/20250313141555_authentication_tokens.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("authentication_tokens")
            .addColumn("id", "serial", (col) => col.primaryKey())
            .addColumn("user_id", "integer")
            .addColumn("tries", "integer", (col) => col.notNull().defaultTo(0))
            .addColumn("expired_at", "timestamptz")
            .addColumn("ip", "varchar(100)")
            .addColumn("browser", "varchar(100)")
            .addColumn("os", "varchar(100)")
            .addColumn("created_at", "timestamptz", (col) => col.defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.defaultTo((0, kysely_1.sql) `now()`))
            .addForeignKeyConstraint("authentication_tokens_user_id_fk", ["user_id"], "users", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .execute();
        yield db.schema
            .createIndex("idx_authentication_tokens_user_id")
            .on("authentication_tokens")
            .column("user_id")
            .execute();
        yield db.schema
            .createIndex("idx_authentication_tokens_expired_at")
            .on("authentication_tokens")
            .column("expired_at")
            .execute();
        yield db.schema
            .createIndex("idx_authentication_tokens_created_at")
            .on("authentication_tokens")
            .column("created_at")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("authentication_tokens").execute();
    });
}
