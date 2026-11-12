// src/modules/jobs/cleanup.job.ts
import {Kysely, sql, type RawBuilder} from "kysely";
import {__ENV} from "../../config/environment";
import {logger} from "../../config/logger";
import {db} from "../../config/database";
import type {Database} from "../../config/schema";

type CleanupTable =
    | "authentication_tokens"
    | "password_recoveries"
    | "two_factor_authentications"
    | "refresh_tokens"
    | "verification_tokens"
    | "rate_limits"
    | "idempotency_keys";

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

    constructor(
        private readonly dbInstance: Kysely<Database> = db,
    ) {
    }

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
            "authentication_tokens",
            sql<boolean>`expired_at < now()`,
            1000,
        );

        const recoveries = await this.deleteBatched(
            "password_recoveries",
            sql<boolean>`expired_at < now()`,
            500,
        );

        const tfa = await this.deleteBatched(
            "two_factor_authentications",
            sql<boolean>`expired_at < now() or expired_tries_at < now()`,
            500,
        );

        const refreshTokens = await this.deleteBatched(
            "refresh_tokens",
            sql<boolean>`expires_at < now()`,
            500,
        );

        const verifications = await this.deleteBatched(
            "verification_tokens",
            sql<boolean>`expires_at < now() or consumed_at is not null`,
            500,
        );

        const rateLimits = await this.deleteBatched(
            "rate_limits",
            sql<boolean>`expires_at < now()`,
            1000,
        );

        const idempotencyKeys = await this.deleteBatched(
            "idempotency_keys",
            sql<boolean>`expires_at < now()`,
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
     *
     * PostgreSQL does not support `DELETE ... LIMIT`, so the batch is
     * selected by `ctid` in a subquery. `ctid` is a physical row
     * identifier and is safe to use inside the same statement.
     */
    private async deleteBatched(
        table: CleanupTable,
        predicate: RawBuilder<boolean>,
        batchSize: number,
    ): Promise<number> {
        let total = 0;

        for (;;) {
            const result = await sql`
                DELETE FROM ${sql.table(table)}
                WHERE ctid IN (
                    SELECT ctid
                    FROM ${sql.table(table)}
                    WHERE ${predicate}
                    LIMIT ${batchSize}
                )
            `.execute(this.dbInstance);

            const deleted = Number(result.numAffectedRows ?? 0);

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
