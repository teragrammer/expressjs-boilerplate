// src/modules/auth/password-recovery/password-recovery.repository.ts
import type {Transaction} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import type {Database} from "../../../config/schema";
import {
    PasswordRecovery,
    PasswordRecoveryCreateData,
    Type,
} from "./password-recovery.interface";

export const PASSWORD_RECOVERIES_TABLE = "password_recoveries";

export class PasswordRecoveryRepository {
    constructor(private readonly db: DatabaseExecutor = defaultDb) {
    }

    async findBySendTo(
        sendTo: string,
        type?: Type,
    ): Promise<PasswordRecovery | null> {
        let query = this.db
            .selectFrom(PASSWORD_RECOVERIES_TABLE)
            .selectAll()
            .where("send_to", "=", sendTo);

        if (type) {
            query = query.where("type", "=", type);
        }

        const record = await query.executeTakeFirst();

        return record ?? null;
    }

    async create(
        data: PasswordRecoveryCreateData,
        trx?: Transaction<Database>,
    ): Promise<PasswordRecovery> {
        const executor: DatabaseExecutor = trx ?? this.db;

        return executor
            .insertInto(PASSWORD_RECOVERIES_TABLE)
            .values({
                ...data,
                tries: data.tries ?? 0,
                next_try_at: data.next_try_at ?? null,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async update(
        id: number,
        data: Partial<PasswordRecovery>,
        trx?: Transaction<Database>,
    ): Promise<PasswordRecovery | null> {
        const executor: DatabaseExecutor = trx ?? this.db;

        // Never overwrite the primary key or creation timestamp.
        const {
            id: _ignoredId,
            created_at: _ignoredCreatedAt,
            ...updatable
        } = data;

        const record = await executor
            .updateTable(PASSWORD_RECOVERIES_TABLE)
            .set({
                ...updatable,
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .returningAll()
            .executeTakeFirst();

        return record ?? null;
    }

    async deleteById(
        id: number,
        trx?: Transaction<Database>,
    ): Promise<boolean> {
        const executor: DatabaseExecutor = trx ?? this.db;

        const result = await executor
            .deleteFrom(PASSWORD_RECOVERIES_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }

    async deleteBySendTo(
        sendTo: string,
        type?: Type,
        trx?: Transaction<Database>,
    ): Promise<boolean> {
        const executor: DatabaseExecutor = trx ?? this.db;

        let query = executor
            .deleteFrom(PASSWORD_RECOVERIES_TABLE)
            .where("send_to", "=", sendTo);

        if (type) {
            query = query.where("type", "=", type);
        }

        const result = await query.executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }

    async withTransaction<T>(
        callback: (trx: Transaction<Database>) => Promise<T>,
    ): Promise<T> {
        if (!("transaction" in this.db)) {
            throw new Error(
                "withTransaction requires the shared database instance, not a transaction.",
            );
        }

        return this.db.transaction().execute(callback);
    }

    async updateTries(
        id: number,
        tries: number,
        nextTryAt: Date | null,
    ): Promise<void> {
        await this.db
            .updateTable(PASSWORD_RECOVERIES_TABLE)
            .set({
                tries,
                next_try_at: nextTryAt,
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .execute();
    }
}
