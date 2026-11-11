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
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        // Drop the existing FK constraint with CASCADE
        yield db.schema
            .alterTable("route_guards")
            .dropConstraint("route_guards_role_id_fk")
            .execute();
        // Add new FK constraint with RESTRICT
        yield db.schema
            .alterTable("route_guards")
            .addForeignKeyConstraint("route_guards_role_id_fk", ["role_id"], "roles", ["id"], (cb) => cb.onUpdate("cascade").onDelete("restrict"))
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        // Drop the RESTRICT constraint
        yield db.schema
            .alterTable("route_guards")
            .dropConstraint("route_guards_role_id_fk")
            .execute();
        // Restore the CASCADE constraint
        yield db.schema
            .alterTable("route_guards")
            .addForeignKeyConstraint("route_guards_role_id_fk", ["role_id"], "roles", ["id"], (cb) => cb.onUpdate("cascade").onDelete("cascade"))
            .execute();
    });
}
