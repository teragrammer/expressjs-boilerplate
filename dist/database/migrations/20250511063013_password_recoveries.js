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
// database/migrations/20250511063013_password_recoveries.ts
const kysely_1 = require("kysely");
const password_recovery_interface_1 = require("../../src/modules/auth/password-recovery/password-recovery.interface");
const TYPE_CHECK_VALUES = password_recovery_interface_1.TYPES.map((type) => `'${type}'`).join(", ");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("password_recoveries")
            .addColumn("id", "serial", (col) => col.primaryKey())
            .addColumn("type", "varchar(20)", (col) => col.notNull())
            .addColumn("send_to", "varchar(100)", (col) => col.notNull())
            .addColumn("code", "varchar(100)", (col) => col.notNull())
            .addColumn("next_resend_at", "timestamptz", (col) => col.notNull())
            .addColumn("expired_at", "timestamptz", (col) => col.notNull())
            .addColumn("tries", "integer", (col) => col.notNull().defaultTo(0))
            .addColumn("next_try_at", "timestamptz")
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addUniqueConstraint("uq_password_recoveries_type_send_to", [
            "type",
            "send_to",
        ])
            .addCheckConstraint("password_recoveries_type_check", (0, kysely_1.sql) `type in (${kysely_1.sql.raw(TYPE_CHECK_VALUES)})`)
            .execute();
        yield db.schema
            .createIndex("idx_password_recoveries_type_send_to")
            .on("password_recoveries")
            .columns(["type", "send_to"])
            .execute();
        yield db.schema
            .createIndex("idx_password_recoveries_next_resend_at")
            .on("password_recoveries")
            .column("next_resend_at")
            .execute();
        yield db.schema
            .createIndex("idx_password_recoveries_expired_at")
            .on("password_recoveries")
            .column("expired_at")
            .execute();
        yield db.schema
            .createIndex("idx_password_recoveries_next_try_at")
            .on("password_recoveries")
            .column("next_try_at")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("password_recoveries").execute();
    });
}
