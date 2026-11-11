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
// database/migrations/20261112000003_add_audit_logs.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .createTable("audit_logs")
            .addColumn("id", "bigserial", (col) => col.primaryKey())
            .addColumn("occurred_at", "timestamptz", (col) => col.notNull().defaultTo((0, kysely_1.sql) `now()`))
            .addColumn("actor_user_id", "integer")
            .addColumn("actor_type", "varchar(20)", (col) => col.notNull().defaultTo("anonymous"))
            .addColumn("action", "varchar(100)", (col) => col.notNull())
            .addColumn("target_type", "varchar(50)")
            .addColumn("target_id", "varchar(100)")
            .addColumn("outcome", "varchar(20)", (col) => col.notNull())
            .addColumn("request_id", "varchar(128)")
            .addColumn("ip", "varchar(100)")
            .addColumn("user_agent", "varchar(255)")
            .addColumn("metadata", "jsonb", (col) => col.notNull().defaultTo((0, kysely_1.sql) `'{}'::jsonb`))
            .execute();
        yield db.schema
            .createIndex("idx_audit_logs_occurred_at")
            .on("audit_logs")
            .column("occurred_at")
            .execute();
        yield db.schema
            .createIndex("idx_audit_logs_actor_occurred")
            .on("audit_logs")
            .columns(["actor_user_id", "occurred_at"])
            .execute();
        yield db.schema
            .createIndex("idx_audit_logs_action_occurred")
            .on("audit_logs")
            .columns(["action", "occurred_at"])
            .execute();
        /*
         * Audit rows are append-only.
         *
         * The trigger rejects UPDATE so an existing event cannot be
         * rewritten. DELETE is left permitted because retention needs to
         * remove old rows; in production the runtime role must not hold
         * DELETE on this table (grant it to a maintenance role only).
         */
        yield (0, kysely_1.sql) `
        CREATE OR REPLACE FUNCTION audit_logs_prevent_mutation()
        RETURNS TRIGGER AS $$
        BEGIN
            RAISE EXCEPTION 'audit_logs is append-only';
        END;
        $$ LANGUAGE plpgsql;
    `.execute(db);
        yield (0, kysely_1.sql) `
        CREATE TRIGGER audit_logs_append_only
        BEFORE UPDATE ON audit_logs
        FOR EACH ROW EXECUTE FUNCTION audit_logs_prevent_mutation();
    `.execute(db);
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, kysely_1.sql) `DROP TRIGGER IF EXISTS audit_logs_append_only ON audit_logs;`.execute(db);
        yield (0, kysely_1.sql) `DROP FUNCTION IF EXISTS audit_logs_prevent_mutation();`.execute(db);
        yield db.schema.dropTable("audit_logs").execute();
    });
}
