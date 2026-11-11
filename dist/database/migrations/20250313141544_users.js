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
// database/migrations/20250313141544_users.ts
const kysely_1 = require("kysely");
const user_interface_1 = require("../../src/modules/users/user.interface");
const GENDER_CHECK_VALUES = user_interface_1.GENDERS.map((gender) => `'${gender}'`).join(", ");
const STATUS_CHECK_VALUES = user_interface_1.STATUSES.map((status) => `'${status}'`).join(", ");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("users")
            .addColumn("id", "serial", (col) => col.primaryKey())
            .addColumn("first_name", "varchar(100)")
            .addColumn("middle_name", "varchar(100)")
            .addColumn("last_name", "varchar(100)")
            .addColumn("gender", "varchar(10)")
            .addColumn("address", "text")
            .addColumn("phone", "varchar(22)", (col) => col.unique())
            .addColumn("is_phone_verified", "boolean", (col) => col.notNull().defaultTo(false))
            .addColumn("email", "varchar(180)", (col) => col.unique())
            .addColumn("is_email_verified", "boolean", (col) => col.notNull().defaultTo(false))
            .addColumn("has_tfa", "boolean", (col) => col.notNull().defaultTo(false))
            .addColumn("tfa_secret", "varchar(100)")
            .addColumn("role_id", "integer", (col) => col.notNull())
            .addColumn("username", "varchar(16)", (col) => col.unique())
            .addColumn("password", "text")
            .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("Activated"))
            .addColumn("login_tries", "integer", (col) => col.notNull().defaultTo(0))
            .addColumn("failed_login_expired_at", "timestamptz")
            .addColumn("comments", "text")
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("deleted_at", "timestamptz")
            .addForeignKeyConstraint("users_role_id_fk", ["role_id"], "roles", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .addCheckConstraint("users_gender_check", (0, kysely_1.sql) `gender is null or gender in (${kysely_1.sql.raw(GENDER_CHECK_VALUES)})`)
            .addCheckConstraint("users_status_check", (0, kysely_1.sql) `status in (${kysely_1.sql.raw(STATUS_CHECK_VALUES)})`)
            .execute();
        /*
         * Browse:
         *
         * WHERE deleted_at IS NULL
         *   AND role_id = ?
         *   AND status = ?
         *   AND id < ?
         * ORDER BY id DESC
         * LIMIT ?
         */
        yield db.schema
            .createIndex("idx_users_browse_role_status")
            .on("users")
            .columns(["deleted_at", "role_id", "status", "id"])
            .execute();
        /*
         * Browse:
         *
         * WHERE deleted_at IS NULL
         *   AND status = ?
         *   AND id < ?
         * ORDER BY id DESC
         * LIMIT ?
         */
        yield db.schema
            .createIndex("idx_users_browse_status")
            .on("users")
            .columns(["deleted_at", "status", "id"])
            .execute();
        /*
         * Browse:
         *
         * WHERE deleted_at IS NULL
         *   AND role_id = ?
         *   AND id < ?
         * ORDER BY id DESC
         * LIMIT ?
         */
        yield db.schema
            .createIndex("idx_users_browse_role")
            .on("users")
            .columns(["deleted_at", "role_id", "id"])
            .execute();
        /*
         * Supports queries that specifically filter by deleted_at.
         */
        yield db.schema
            .createIndex("idx_users_deleted_id")
            .on("users")
            .columns(["deleted_at", "id"])
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("users").execute();
    });
}
