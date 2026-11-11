// src/modules/auth/verification/verification.repository.ts
import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import {
    CreateVerificationTokenInput,
    VerificationChannel,
    VerificationToken,
} from "./verification.interface";

export const VERIFICATION_TOKEN_TABLE = "verification_tokens";

export class VerificationRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    async create(
        data: CreateVerificationTokenInput,
        executor: DatabaseExecutor = this.db,
    ): Promise<VerificationToken> {
        return executor
            .insertInto(VERIFICATION_TOKEN_TABLE)
            .values({
                user_id: data.user_id,
                channel: data.channel,
                target: data.target,
                token_hash: data.token_hash,
                expires_at: data.expires_at,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async findByHash(
        tokenHash: string,
    ): Promise<VerificationToken | null> {
        const row = await this.db
            .selectFrom(VERIFICATION_TOKEN_TABLE)
            .selectAll()
            .where("token_hash", "=", tokenHash)
            .executeTakeFirst();

        return row ?? null;
    }

    /**
     * Invalidates every pending token for a user/channel pair.
     *
     * Called when a new token is issued or the target changes, so a
     * stale token can never be redeemed.
     */
    async invalidateForUserChannel(
        userId: number,
        channel: VerificationChannel,
        executor: DatabaseExecutor = this.db,
    ): Promise<number> {
        const result = await executor
            .updateTable(VERIFICATION_TOKEN_TABLE)
            .set({
                consumed_at: new Date(),
                updated_at: new Date(),
            })
            .where("user_id", "=", userId)
            .where("channel", "=", channel)
            .where("consumed_at", "is", null)
            .executeTakeFirst();

        return Number(result.numUpdatedRows);
    }

    async incrementAttempts(id: string): Promise<void> {
        await this.db
            .updateTable(VERIFICATION_TOKEN_TABLE)
            .set({
                attempts: sql<number>`attempts + 1`,
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .execute();
    }

    async consume(id: string): Promise<void> {
        await this.db
            .updateTable(VERIFICATION_TOKEN_TABLE)
            .set({
                consumed_at: new Date(),
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .execute();
    }

    /**
     * Checks whether a target is already verified for a user.
     */
    async isTargetVerified(
        userId: number,
        channel: VerificationChannel,
        target: string,
    ): Promise<boolean> {
        const row = await this.db
            .selectFrom(VERIFICATION_TOKEN_TABLE)
            .select("id")
            .where("user_id", "=", userId)
            .where("channel", "=", channel)
            .where("target", "=", target)
            .where("consumed_at", "is not", null)
            .where("expires_at", ">", sql<Date>`now()`)
            .executeTakeFirst();

        return Boolean(row);
    }
}
