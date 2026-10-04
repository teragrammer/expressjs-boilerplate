// src/modules/auth/two-factor-authentication/two-factor-authentication.repository.ts

import {sql} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import {TwoFactorAuthentication} from "./two-factor-authentication.interface";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";

export const TWO_FACTOR_AUTHENTICATION_TABLE =
    "two_factor_authentications";

export class TwoFactorAuthenticationRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    public async findByTokenId(
        tokenId: number,
    ): Promise<TwoFactorAuthentication | null> {
        const result = await this.db
            .selectFrom(TWO_FACTOR_AUTHENTICATION_TABLE)
            .selectAll()
            .where("token_id", "=", tokenId)
            .executeTakeFirst();

        return result || null;
    }

    /**
     * Atomically issues or refreshes an OTP.
     *
     * The transaction + row lock prevents two concurrent requests
     * from refreshing the same existing OTP at the same time.
     *
     * The unique token_id constraint handles the special case where
     * two concurrent requests attempt to create the first OTP row.
     */
    public async issueOtp(
        tokenId: number,
        data: {
            code: string;
            expired_at: Date | string;
            next_send_at: Date | string;
            created_at: Date | string;
        },
    ): Promise<TwoFactorAuthentication> {
        if (!("transaction" in this.db)) {
            throw new Error(
                "issueOtp requires the shared database instance, not a transaction.",
            );
        }

        return this.db.transaction().execute(async (trx) => {
            const findExisting = () =>
                trx
                    .selectFrom(TWO_FACTOR_AUTHENTICATION_TABLE)
                    .selectAll()
                    .where("token_id", "=", tokenId)
                    .forUpdate()
                    .executeTakeFirst();

            let existing = await findExisting();

            /*
             * First OTP for this token.
             *
             * FOR UPDATE cannot lock a row that doesn't exist, so
             * two concurrent requests can both reach INSERT.
             *
             * The UNIQUE(token_id) constraint guarantees that only
             * one request can actually create the row.
             */
            if (!existing) {
                try {
                    return await trx
                        .insertInto(TWO_FACTOR_AUTHENTICATION_TABLE)
                        .values({
                            token_id: tokenId,
                            code: data.code,
                            tries: 0,
                            expired_at: data.expired_at,
                            next_send_at: data.next_send_at,
                            created_at: data.created_at,
                        })
                        .returningAll()
                        .executeTakeFirstOrThrow();
                } catch (error) {
                    /*
                     * PostgreSQL unique violation.
                     *
                     * Another request won the race and inserted
                     * the OTP row first.
                     */
                    if (!this.isUniqueViolation(error)) {
                        throw error;
                    }

                    /*
                     * Re-read the row and acquire the row lock.
                     */
                    existing = await findExisting();

                    if (!existing) {
                        throw error;
                    }
                }
            }

            /*
             * Existing OTP.
             *
             * Because the row is locked with FOR UPDATE, another
             * transaction cannot modify it until this transaction
             * finishes.
             */
            if (
                existing.next_send_at &&
                new Date(existing.next_send_at) > new Date()
            ) {
                throw new AppError(Messages.RESEND_OTP_NOT_POSSIBLE);
            }

            return trx
                .updateTable(TWO_FACTOR_AUTHENTICATION_TABLE)
                .set({
                    code: data.code,
                    expired_at: data.expired_at,
                    next_send_at: data.next_send_at,
                    updated_at: sql<Date>`now()`,
                })
                .where("id", "=", existing.id)
                .returningAll()
                .executeTakeFirstOrThrow();
        });
    }

    /**
     * PostgreSQL unique-constraint violation.
     */
    private isUniqueViolation(error: unknown): boolean {
        return (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            (error as { code?: string }).code === "23505"
        );
    }

    /**
     * Increments invalid OTP attempts atomically.
     */
    public async incrementTries(id: number): Promise<void> {
        await this.db
            .updateTable(TWO_FACTOR_AUTHENTICATION_TABLE)
            .set({
                tries: sql<number>`tries + 1`,
                updated_at: sql<Date>`now()`,
            })
            .where("id", "=", id)
            .execute();
    }

    /**
     * Resets rate limits once lockout expires.
     */
    public async resetTries(id: number): Promise<void> {
        await this.db
            .updateTable(TWO_FACTOR_AUTHENTICATION_TABLE)
            .set({
                tries: 0,
                expired_tries_at: null,
                updated_at: sql<Date>`now()`,
            })
            .where("id", "=", id)
            .execute();
    }

    /**
     * Consumes the OTP after successful verification.
     */
    public async deleteById(id: number): Promise<boolean> {
        const result = await this.db
            .deleteFrom(TWO_FACTOR_AUTHENTICATION_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }
}
