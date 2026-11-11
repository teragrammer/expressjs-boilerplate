// src/modules/auth/authentication/refresh-token.repository.ts
import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";

export const REFRESH_TOKEN_TABLE = "refresh_tokens";

export interface RefreshTokenRow {
    id: string;
    session_id: number;
    user_id: number;
    token_hash: string;
    family_id: string;
    expires_at: Date | string;
    revoked_at: Date | string | null;
    replaced_by: string | null;
    ip: string | null;
    user_agent: string | null;
    created_at: Date | string;
    updated_at: Date | string;
}

export interface CreateRefreshTokenInput {
    session_id: number;
    user_id: number;
    token_hash: string;
    family_id: string;
    expires_at: Date;
    ip?: string | null;
    user_agent?: string | null;
}

export class RefreshTokenRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    async create(data: CreateRefreshTokenInput): Promise<RefreshTokenRow> {
        return this.db
            .insertInto(REFRESH_TOKEN_TABLE)
            .values({
                session_id: data.session_id,
                user_id: data.user_id,
                token_hash: data.token_hash,
                family_id: data.family_id,
                expires_at: data.expires_at,
                ip: data.ip ?? null,
                user_agent: data.user_agent ?? null,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    /**
     * Finds a refresh token by its stored hash.
     */
    async findByHash(
        tokenHash: string,
    ): Promise<RefreshTokenRow | null> {
        const row = await this.db
            .selectFrom(REFRESH_TOKEN_TABLE)
            .selectAll()
            .where("token_hash", "=", tokenHash)
            .executeTakeFirst();

        return row ?? null;
    }

    /**
     * Marks a token as used: revoked and replaced by its successor.
     */
    async revoke(
        id: string,
        replacedBy: string | null,
    ): Promise<void> {
        await this.db
            .updateTable(REFRESH_TOKEN_TABLE)
            .set({
                revoked_at: new Date(),
                replaced_by: replacedBy,
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .execute();
    }

    /**
     * Revokes every token in a family.
     *
     * Used when reuse is detected: presenting an already-used refresh
     * token means the family is compromised and must be invalidated.
     */
    async revokeFamily(familyId: string): Promise<number> {
        const result = await this.db
            .updateTable(REFRESH_TOKEN_TABLE)
            .set({
                revoked_at: sql<Date>`COALESCE(revoked_at, now())`,
                updated_at: new Date(),
            })
            .where("family_id", "=", familyId)
            .where("revoked_at", "is", null)
            .executeTakeFirst();

        return Number(result.numUpdatedRows);
    }

    /**
     * Revokes every refresh token for a session.
     */
    async revokeBySessionId(sessionId: number): Promise<number> {
        const result = await this.db
            .updateTable(REFRESH_TOKEN_TABLE)
            .set({
                revoked_at: sql<Date>`COALESCE(revoked_at, now())`,
                updated_at: new Date(),
            })
            .where("session_id", "=", sessionId)
            .where("revoked_at", "is", null)
            .executeTakeFirst();

        return Number(result.numUpdatedRows);
    }

    /**
     * Revokes every refresh token for a user.
     */
    async revokeAllByUserId(userId: number): Promise<number> {
        const result = await this.db
            .updateTable(REFRESH_TOKEN_TABLE)
            .set({
                revoked_at: sql<Date>`COALESCE(revoked_at, now())`,
                updated_at: new Date(),
            })
            .where("user_id", "=", userId)
            .where("revoked_at", "is", null)
            .executeTakeFirst();

        return Number(result.numUpdatedRows);
    }

    /**
     * Lists the active refresh tokens (sessions) of a user.
     */
    async findActiveByUserId(userId: number): Promise<RefreshTokenRow[]> {
        return this.db
            .selectFrom(REFRESH_TOKEN_TABLE)
            .selectAll()
            .where("user_id", "=", userId)
            .where("revoked_at", "is", null)
            .where("expires_at", ">", sql<Date>`now()`)
            .orderBy("created_at", "desc")
            .execute();
    }

    /**
     * Removes expired and already-revoked rows.
     */
    async purgeExpired(): Promise<number> {
        const result = await this.db
            .deleteFrom(REFRESH_TOKEN_TABLE)
            .where("expires_at", "<", sql<Date>`now()`)
            .executeTakeFirst();

        return Number(result.numDeletedRows);
    }
}
