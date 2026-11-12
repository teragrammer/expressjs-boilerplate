// src/modules/auth/authentication/authentication-token.repository.ts
import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import {
    AuthenticationToken,
    CreateAuthenticationTokenInput,
    UpdateAuthenticationTokenInput
} from "./authentication.interface";

export const AUTHENTICATION_TOKEN_TABLE = "authentication_tokens";
export const TWO_FACTOR_AUTHENTICATION_TABLE = "two_factor_authentications";

export class AuthenticationTokenRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    /**
     * Persists a new authentication token record in the database.
     *
     * An optional executor allows the caller to create the session row
     * inside a surrounding transaction.
     */
    public async create(
        data: CreateAuthenticationTokenInput,
        executor: DatabaseExecutor = this.db,
    ): Promise<AuthenticationToken> {
        return executor
            .insertInto(AUTHENTICATION_TOKEN_TABLE)
            .values(data)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    /**
     * Retrieves an active, unexpired token record by its ID.
     * Enforces session expiry and user_id matching for security.
     */
    public async findById(id: number, userId?: number): Promise<AuthenticationToken | null> {
        let query = this.db
            .selectFrom(AUTHENTICATION_TOKEN_TABLE)
            .selectAll()
            .where("id", "=", id)
            .where("expired_at", ">", sql<Date>`now()`);

        if (userId !== undefined) {
            query = query.where("user_id", "=", userId);
        }

        const token = await query.executeTakeFirst();

        return token || null;
    }

    /**
     * Finds all active (unexpired) tokens associated with a specific user.
     */
    public async findByUserId(userId: number): Promise<AuthenticationToken[]> {
        return this.db
            .selectFrom(AUTHENTICATION_TOKEN_TABLE)
            .selectAll()
            .where("user_id", "=", userId)
            .where("expired_at", ">", sql<Date>`now()`)
            .orderBy("created_at", "desc")
            .execute();
    }

    /**
     * Partially updates an existing token record by its ID.
     */
    public async update(
        id: number,
        data: UpdateAuthenticationTokenInput,
        executor: DatabaseExecutor = this.db,
    ): Promise<AuthenticationToken | null> {
        const updatedToken = await executor
            .updateTable(AUTHENTICATION_TOKEN_TABLE)
            .set({
                ...data,
                updated_at: sql<Date>`now()`,
            })
            .where("id", "=", id)
            .returningAll()
            .executeTakeFirst();

        return updatedToken || null;
    }

    /**
     * Atomically increments the retry count and updates the timestamp.
     */
    public async incrementTries(id: number): Promise<void> {
        await this.db
            .updateTable(AUTHENTICATION_TOKEN_TABLE)
            .set({
                tries: sql<number>`tries + 1`,
                updated_at: sql<Date>`now()`,
            })
            .where("id", "=", id)
            .execute();
    }

    /**
     * Marks the session as having completed the second factor.
     */
    public async markTfaVerified(
        id: number,
        executor: DatabaseExecutor = this.db,
    ): Promise<void> {
        await executor
            .updateTable(AUTHENTICATION_TOKEN_TABLE)
            .set({
                tfa_verified: true,
                updated_at: sql<Date>`now()`,
            })
            .where("id", "=", id)
            .execute();
    }

    /**
     * Deletes a single token record by its primary ID.
     * Also deletes associated 2FA records to maintain referential integrity.
     */
    public async deleteById(id: number): Promise<boolean> {
        // First delete associated 2FA records
        await this.db
            .deleteFrom(TWO_FACTOR_AUTHENTICATION_TABLE)
            .where("token_id", "=", id)
            .execute();

        const result = await this.db
            .deleteFrom(AUTHENTICATION_TOKEN_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }

    /**
     * Revokes (deletes) all tokens linked to a specific user (including expired).
     * Also deletes associated 2FA records.
     */
    public async deleteAllByUserId(
        userId: number,
        excludeTokenId?: number,
        executor: DatabaseExecutor = this.db,
    ): Promise<number> {
        // First delete all 2FA records for this user's tokens (excluding the excluded one)
        let tokenQuery = executor
            .selectFrom(AUTHENTICATION_TOKEN_TABLE)
            .select("id")
            .where("user_id", "=", userId);

        if (excludeTokenId !== undefined) {
            tokenQuery = tokenQuery.where("id", "!=", excludeTokenId);
        }

        const tokens = await tokenQuery.execute();

        if (tokens.length > 0) {
            const tokenIds = tokens.map(t => t.id);
            await executor
                .deleteFrom(TWO_FACTOR_AUTHENTICATION_TABLE)
                .where("token_id", "in", tokenIds)
                .execute();
        }

        // Now delete the tokens
        let deleteQuery = executor
            .deleteFrom(AUTHENTICATION_TOKEN_TABLE)
            .where("user_id", "=", userId);

        if (excludeTokenId !== undefined) {
            deleteQuery = deleteQuery.where("id", "!=", excludeTokenId);
        }

        const result = await deleteQuery.executeTakeFirst();

        return Number(result.numDeletedRows);
    }

    /**
     * Automatically purges obsolete or expired session tokens from the table.
     * Also deletes associated 2FA records.
     */
    public async purgeExpiredTokensByUserId(userId: number): Promise<number> {
        // First get expired token IDs
        const expiredTokens = await this.db
            .selectFrom(AUTHENTICATION_TOKEN_TABLE)
            .select("id")
            .where("user_id", "=", userId)
            .where("expired_at", "<", sql<Date>`now()`)
            .execute();

        if (expiredTokens.length > 0) {
            const tokenIds = expiredTokens.map(t => t.id);
            // Delete associated 2FA records
            await this.db
                .deleteFrom(TWO_FACTOR_AUTHENTICATION_TABLE)
                .where("token_id", "in", tokenIds)
                .execute();

            // Delete expired tokens
            const result = await this.db
                .deleteFrom(AUTHENTICATION_TOKEN_TABLE)
                .where("id", "in", tokenIds)
                .executeTakeFirst();

            return Number(result.numDeletedRows);
        }

        return 0;
    }
}
