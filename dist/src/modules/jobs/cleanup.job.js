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
exports.CleanupJob = void 0;
// src/modules/jobs/cleanup.job.ts
const kysely_1 = require("kysely");
const environment_1 = require("../../config/environment");
const logger_1 = require("../../config/logger");
const database_1 = require("../../config/database");
/**
 * Scheduled maintenance.
 *
 * Expired sessions, recovery codes, OTPs, refresh tokens, verification
 * tokens and rate-limit rows would otherwise accumulate indefinitely.
 * A bounded cleanup keeps table growth predictable without holding long
 * locks.
 */
class CleanupJob {
    /**
     * Runs one cleanup pass.
     */
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            const sessions = yield this.deleteBatched(() => database_1.db
                .deleteFrom("authentication_tokens")
                .where("expired_at", "<", (0, kysely_1.sql) `now()`), 1000);
            const recoveries = yield this.deleteBatched(() => database_1.db
                .deleteFrom("password_recoveries")
                .where("expired_at", "<", (0, kysely_1.sql) `now()`), 500);
            const tfa = yield this.deleteBatched(() => database_1.db
                .deleteFrom("two_factor_authentications")
                .where((eb) => eb.or([
                eb("expired_at", "<", (0, kysely_1.sql) `now()`),
                eb("expired_tries_at", "<", (0, kysely_1.sql) `now()`),
            ])), 500);
            const refreshTokens = yield this.deleteBatched(() => database_1.db
                .deleteFrom("refresh_tokens")
                .where("expires_at", "<", (0, kysely_1.sql) `now()`), 500);
            const verifications = yield this.deleteBatched(() => database_1.db
                .deleteFrom("verification_tokens")
                .where((eb) => eb.or([
                eb("expires_at", "<", (0, kysely_1.sql) `now()`),
                eb("consumed_at", "is not", null),
            ])), 500);
            const rateLimits = yield this.deleteBatched(() => database_1.db
                .deleteFrom("rate_limits")
                .where("expires_at", "<", (0, kysely_1.sql) `now()`), 1000);
            const idempotencyKeys = yield this.deleteBatched(() => database_1.db
                .deleteFrom("idempotency_keys")
                .where("expires_at", "<", (0, kysely_1.sql) `now()`), 500);
            logger_1.logger.info({
                sessions,
                recoveries,
                tfa,
                refreshTokens,
                verifications,
                rateLimits,
                idempotencyKeys,
            }, "Cleanup job completed");
            return {
                sessions,
                recoveries,
                tfa,
                refreshTokens,
                verifications,
                rateLimits,
                idempotencyKeys,
            };
        });
    }
    /**
     * Deletes rows in bounded batches to avoid long locks.
     */
    deleteBatched(buildQuery, batchSize) {
        return __awaiter(this, void 0, void 0, function* () {
            let total = 0;
            for (;;) {
                const result = yield buildQuery()
                    .limit(batchSize)
                    .executeTakeFirst();
                const deleted = Number(result.numDeletedRows);
                total += deleted;
                if (deleted < batchSize) {
                    break;
                }
            }
            return total;
        });
    }
    /**
     * Starts the periodic cleanup.
     */
    start() {
        if (this.timer) {
            return;
        }
        this.timer = setInterval(() => {
            void this.run().catch((error) => {
                logger_1.logger.error({ message: error.message }, "Cleanup job failed");
            });
        }, environment_1.__ENV.CLEANUP_INTERVAL_MS);
        this.timer.unref();
        logger_1.logger.info(`[Cleanup] Scheduled every ${environment_1.__ENV.CLEANUP_INTERVAL_MS}ms`);
    }
    /**
     * Stops the periodic cleanup.
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
}
exports.CleanupJob = CleanupJob;
