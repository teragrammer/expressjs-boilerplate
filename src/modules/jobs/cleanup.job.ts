// src/modules/jobs/cleanup.job.ts
import {sql} from "kysely";
import {__ENV} from "../../config/environment";
import {logger} from "../../config/logger";
import {db} from "../../config/database";

/**
 * Scheduled maintenance.
 *
 * Expired sessions, recovery codes, OTPs, refresh tokens, verification
 * tokens and rate-limit rows would otherwise accumulate indefinitely.
 * A bounded cleanup keeps table growth predictable without holding long
 * locks.
 */
export class CleanupJob {
    private timer?: NodeJS.Timeout;

    /**
     * Runs one cleanup pass.
     */
    async run(): Promise<{
        sessions: number;
        recoveries: number;
        tfa: number;
        refreshTokens: number;
        verifications: number;
        rateLimits: number;
        idempotencyKeys: number;
    }> {
        const sessions = await this.deleteBatched(
            () =>
                db
                    .deleteFrom("authentication_tokens")
                    .where("expired_at", "<", sql<Date>`now()`),
            1000,
        );

        const recoveries = await this.deleteBatched(
            () =>
                db
                    .deleteFrom("password_recoveries")
                    .where("expired_at", "<", sql<Date>`now()`),
            500,
        );

        const tfa = await this.deleteBatched(
            () =>
                db
                    .deleteFrom("two_factor_authentications")
                    .where((eb) =>
                        eb.or([
                            eb("expired_at", "<", sql<Date>`now()`),
                            eb("expired_tries_at", "<", sql<Date>`now()`),
                        ]),
                    ),
            500,
        );

        const refreshTokens = await this.deleteBatched(
            () =>
                db
                    .deleteFrom("refresh_tokens")
                    .where("expires_at", "<", sql<Date>`now()`),
            500,
        );

        const verifications = await this.deleteBatched(
            () =>
                db
                    .deleteFrom("verification_tokens")
                    .where((eb) =>
                        eb.or([
                            eb("expires_at", "<", sql<Date>`now()`),
                            eb("consumed_at", "is not", null),
                        ]),
                    ),
            500,
        );

        const rateLimits = await this.deleteBatched(
            () =>
                db
                    .deleteFrom("rate_limits")
                    .where("expires_at", "<", sql<Date>`now()`),
            1000,
        );

        const idempotencyKeys = await this.deleteBatched(
            () =>
                db
                    .deleteFrom("idempotency_keys")
                    .where("expires_at", "<", sql<Date>`now()`),
            500,
        );

        logger.info(
            {
                sessions,
                recoveries,
                tfa,
                refreshTokens,
                verifications,
                rateLimits,
                idempotencyKeys,
            },
            "Cleanup job completed",
        );

        return {
            sessions,
            recoveries,
            tfa,
            refreshTokens,
            verifications,
            rateLimits,
            idempotencyKeys,
        };
    }

    /**
     * Deletes rows in bounded batches to avoid long locks.
     */
    private async deleteBatched(
        buildQuery: () => {
            limit: (value: number) => {
                executeTakeFirst: () => Promise<{
                    numDeletedRows: number | bigint;
                }>;
            };
        },
        batchSize: number,
    ): Promise<number> {
        let total = 0;

        for (;;) {
            const result = await buildQuery()
                .limit(batchSize)
                .executeTakeFirst();

            const deleted = Number(result.numDeletedRows);

            total += deleted;

            if (deleted < batchSize) {
                break;
            }
        }

        return total;
    }

    /**
     * Starts the periodic cleanup.
     */
    start(): void {
        if (this.timer) {
            return;
        }

        this.timer = setInterval(() => {
            void this.run().catch((error: Error) => {
                logger.error(
                    {message: error.message},
                    "Cleanup job failed",
                );
            });
        }, __ENV.CLEANUP_INTERVAL_MS);

        this.timer.unref();

        logger.info(
            `[Cleanup] Scheduled every ${__ENV.CLEANUP_INTERVAL_MS}ms`,
        );
    }

    /**
     * Stops the periodic cleanup.
     */
    stop(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
}
