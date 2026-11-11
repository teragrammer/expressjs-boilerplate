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
// database/migrations/20261112000006_add_route_guards_integrity.ts
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        /*
         * Remove duplicate grants that would block the unique constraint.
         */
        yield (0, kysely_1.sql) `
        DELETE FROM route_guards
        WHERE id NOT IN (
            SELECT MIN(id)
            FROM route_guards
            GROUP BY role_id, route
        )
    `.execute(db);
        yield db.schema
            .createIndex("idx_route_guards_role_id")
            .on("route_guards")
            .column("role_id")
            .execute();
        yield db.schema
            .createIndex("idx_route_guards_role_route_unique")
            .on("route_guards")
            .columns(["role_id", "route"])
            .unique()
            .execute();
        yield (0, kysely_1.sql) `
        ALTER TABLE route_guards
        ADD CONSTRAINT route_guards_route_not_blank
        CHECK (length(btrim(route)) > 0)
    `.execute(db);
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, kysely_1.sql) `ALTER TABLE route_guards DROP CONSTRAINT IF EXISTS route_guards_route_not_blank;`.execute(db);
        yield db.schema.dropIndex("idx_route_guards_role_route_unique").execute();
        yield db.schema.dropIndex("idx_route_guards_role_id").execute();
    });
}
