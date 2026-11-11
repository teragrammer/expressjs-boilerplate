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
// database/migrations/20250313141523_settings.ts
const kysely_1 = require("kysely");
const setting_model_1 = require("../../src/modules/system/settings/setting.model");
const TYPE_CHECK_VALUES = setting_model_1.DATA_TYPES.map((type) => `'${type}'`).join(", ");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("settings")
            .addColumn("id", "serial", (col) => col.primaryKey())
            .addColumn("name", "varchar(100)", (col) => col.notNull().unique())
            .addColumn("slug", "varchar(100)", (col) => col.notNull().unique())
            .addColumn("value", "text")
            .addColumn("description", "text")
            .addColumn("type", "varchar(20)", (col) => col.notNull().defaultTo("string"))
            .addColumn("is_disabled", "boolean", (col) => col.notNull().defaultTo(false))
            .addColumn("is_public", "boolean", (col) => col.notNull().defaultTo(true))
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addCheckConstraint("settings_type_check", (0, kysely_1.sql) `type in (${kysely_1.sql.raw(TYPE_CHECK_VALUES)})`)
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("settings").execute();
    });
}
