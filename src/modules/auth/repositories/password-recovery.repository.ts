// src/modules/auth/repositories/password-recovery.repository.ts
import {Knex} from "knex";
import {DBKnex} from "../../../config/knex";
import {PasswordRecovery, Type,} from "../interfaces/password.recovery.interface";

export const PASSWORD_RECOVERIES_TABLE = "password_recoveries";

export interface PasswordRecoveryCreateData {
    type: Type;
    send_to: string;
    code: string;
    next_resend_at: Date;
    expired_at: Date;
    tries?: number;
    next_try_at?: Date | null;
}

export class PasswordRecoveryRepository {
    constructor(private readonly db: Knex = DBKnex) {
    }

    private table(db: Knex = this.db) {
        return db<PasswordRecovery>(PASSWORD_RECOVERIES_TABLE);
    }

    async findBySendTo(
        sendTo: string,
        type?: Type,
    ): Promise<PasswordRecovery | null> {
        let query = this.table();

        query = query.where({send_to: sendTo});

        if (type) {
            query = query.andWhere({type});
        }

        const record = await query.first();

        return record ?? null;
    }

    async create(
        data: PasswordRecoveryCreateData,
        trx?: Knex.Transaction,
    ): Promise<PasswordRecovery> {
        const [record] = await this.table(trx ?? this.db)
            .insert({
                ...data,
                tries: data.tries ?? 0,
                next_try_at: data.next_try_at ?? null,
            })
            .returning("*");

        return record;
    }

    async update(
        id: number,
        data: Partial<PasswordRecovery>,
        trx?: Knex.Transaction,
    ): Promise<PasswordRecovery | null> {
        const [record] = await this.table(trx ?? this.db)
            .where({id})
            .update({
                ...data,
                updated_at: new Date(),
            })
            .returning("*");

        return record ?? null;
    }

    async deleteById(
        id: number,
        trx?: Knex.Transaction,
    ): Promise<boolean> {
        const deletedRows = await this.table(trx ?? this.db)
            .where({id})
            .delete();

        return deletedRows > 0;
    }

    async deleteBySendTo(
        sendTo: string,
        type?: Type,
        trx?: Knex.Transaction,
    ): Promise<boolean> {
        const query = this.table(trx ?? this.db)
            .where({send_to: sendTo});

        if (type) {
            query.andWhere({type});
        }

        const deletedRows = await query.delete();

        return deletedRows > 0;
    }

    async withTransaction<T>(
        callback: (trx: Knex.Transaction) => Promise<T>,
    ): Promise<T> {
        return this.db.transaction(callback);
    }

    async updateTries(
        id: number,
        tries: number,
        nextTryAt: Date | null,
    ): Promise<void> {
        await this.table()
            .where({id})
            .update({
                tries,
                next_try_at: nextTryAt,
                updated_at: new Date(),
            });
    }
}
