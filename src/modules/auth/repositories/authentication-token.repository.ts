// src/modules/auth/repositories/authentication-token.repository.ts
import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import {
    AuthenticationToken,
    CreateAuthenticationTokenInput,
    UpdateAuthenticationTokenInput
} from "../interfaces/authentication.token";

export const AUTHENTICATION_TOKEN_TABLE = "authentication_tokens";

export class AuthenticationTokenRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    /**
     * Persists a new authentication token record in the database.
     */
    public async create(data: CreateAuthenticationTokenInput): Promise<AuthenticationToken> {
        return this.db
            .insertInto(AUTHENTICATION_TOKEN_TABLE)
            .values(data)
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    /**
     * Retrieves an active, unexpired token record by its ID.
     */
    public async findById(id: number): Promise<AuthenticationToken | null> {
        const token = await this.db
            .selectFrom(AUTHENTICATION_TOKEN_TABLE)
            .selectAll()
            .where("id", "=", id)
            .executeTakeFirst();

        return token || null;
    }

    /**
     * Finds all active tokens associated with a specific user.
     */
    public async findByUserId(userId: number): Promise<AuthenticationToken[]> {
        return this.db
            .selectFrom(AUTHENTICATION_TOKEN_TABLE)
            .selectAll()
            .where("user_id", "=", userId)
            .orderBy("created_at", "desc")
            .execute();
    }

    /**
     * Partially updates an existing token record by its ID.
     */
    public async update(id: number, data: UpdateAuthenticationTokenInput): Promise<AuthenticationToken | null> {
        const updatedToken = await this.db
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
     * Deletes a single token record by its primary ID.
     */
    public async deleteById(id: number): Promise<boolean> {
        const result = await this.db
            .deleteFrom(AUTHENTICATION_TOKEN_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }

    /**
     * Revokes (deletes) all active tokens linked to a specific user.
     */
    public async deleteAllByUserId(userId: number): Promise<number> {
        const result = await this.db
            .deleteFrom(AUTHENTICATION_TOKEN_TABLE)
            .where("user_id", "=", userId)
            .executeTakeFirst();

        return Number(result.numDeletedRows);
    }

    /**
     * Automatically purges obsolete or expired session tokens from the table.
     */
    public async purgeExpiredTokensByUserId(userId: number): Promise<number> {
        const result = await this.db
            .deleteFrom(AUTHENTICATION_TOKEN_TABLE)
            .where("user_id", "=", userId)
            .where("expired_at", "<", sql<Date>`now()`)
            .executeTakeFirst();

        return Number(result.numDeletedRows);
    }
}
