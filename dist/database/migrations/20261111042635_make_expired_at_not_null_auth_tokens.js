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
const kysely_1 = require("kysely");
function up(db) {
    return __awaiter(this, void 0, void 0, function* () {
        // First, backfill NULL expired_at values with a far future date
        // (or we could set them to created_at + 7 days for existing records)
        yield db
            .updateTable("authentication_tokens")
            .set({ expired_at: (0, kysely_1.sql) `created_at + interval '7 days'` })
            .where("expired_at", "is", null)
            .execute();
        // Now make the column NOT NULL
        yield db.schema
            .alterTable("authentication_tokens")
            .alterColumn("expired_at", (col) => col.setNotNull())
            .execute();
    });
}
function down(db) {
    return __awaiter(this, void 0, void 0, function* () {
        // Make the column nullable again
        yield db.schema
            .alterTable("authentication_tokens")
            .alterColumn("expired_at", (col) => col.dropNotNull())
            .execute();
    });
}
