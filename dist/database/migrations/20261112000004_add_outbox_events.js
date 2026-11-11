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
// database/migrations/20261112000004_add_outbox_events.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("outbox_events")
            .addColumn("id", "bigserial", (col) => col.primaryKey())
            .addColumn("type", "varchar(100)", (col) => col.notNull())
            .addColumn("payload", "jsonb", (col) => col.notNull().defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
            .addColumn("status", "varchar(20)", (col) => col.notNull().defaultTo("pending"))
            .addColumn("attempts", "integer", (col) => col.notNull().defaultTo(0))
            .addColumn("available_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("locked_at", "timestamptz")
            .addColumn("locked_by", "varchar(100)")
            .addColumn("last_error", "text")
            .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("processed_at", "timestamptz")
            .addCheckConstraint("outbox_events_status_check", (0, kysely_1.sql) `status in ('pending', 'processing', 'done', 'failed')`)
            .execute();
        yield db.schema
            .createIndex("idx_outbox_events_pending")
            .on("outbox_events")
            .columns(["status", "available_at"])
            .execute();
        yield db.schema
            .createIndex("idx_outbox_events_type")
            .on("outbox_events")
            .column("type")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropTable("outbox_events").execute();
    });
}
