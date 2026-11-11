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
// database/migrations/20261112000009_add_user_id_to_password_recoveries.ts
const kysely_1 = require("kysely");
/**
 * Links a recovery record to the account it belongs to.
 *
 * Without the link, changing a password cannot invalidate the
 * outstanding recovery codes, and cleanup cannot scope deletions to a
 * single user.
 */
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema
            .alterTable("password_recoveries")
            .addColumn("user_id", "integer")
            .execute();
        /*
         * Backfill existing rows by matching the recovery target against
         * the user email/phone columns.
         */
        yield (0, kysely_1.sql) `
        UPDATE password_recoveries pr
        SET user_id = u.id
        FROM users u
        WHERE pr.user_id IS NULL
          AND pr.type = 'email'
          AND u.email = pr.send_to
    `.execute(db);
        yield (0, kysely_1.sql) `
        UPDATE password_recoveries pr
        SET user_id = u.id
        FROM users u
        WHERE pr.user_id IS NULL
          AND pr.type = 'phone'
          AND u.phone = pr.send_to
    `.execute(db);
        yield db.schema
            .alterTable("password_recoveries")
            .addForeignKeyConstraint("password_recoveries_user_id_fk", ["user_id"], "users", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .execute();
        yield db.schema
            .createIndex("idx_password_recoveries_user_id")
            .on("password_recoveries")
            .column("user_id")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield db.schema.dropIndex("idx_password_recoveries_user_id").execute();
        yield db.schema
            .alterTable("password_recoveries")
            .dropConstraint("password_recoveries_user_id_fk")
            .execute();
        yield db.schema
            .alterTable("password_recoveries")
            .dropColumn("user_id")
            .execute();
    });
}
