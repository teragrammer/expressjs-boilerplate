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
        // Add authorization_version column to users table
        yield db.schema
            .alterTable("users")
            .addColumn("authorization_version", "integer", (col) => col.notNull().defaultTo(0))
            .execute();
        // Create index for authorization version lookups
        yield db.schema
            .createIndex("idx_users_authorization_version")
            .on("users")
            .column("authorization_version")
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        // Drop the index
        yield db.schema
            .dropIndex("idx_users_authorization_version")
            .execute();
        // Drop the column
        yield db.schema
            .alterTable("users")
            .dropColumn("authorization_version")
            .execute();
    });
}
