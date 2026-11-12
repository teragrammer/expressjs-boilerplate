// src/modules/auth/two-factor-authentication/tfa-recovery-code.repository.ts
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";

export const TFA_RECOVERY_CODE_TABLE = "tfa_recovery_codes";

export interface TfaRecoveryCode {
    id: number;
    user_id: number;
    code_hash: string;
    created_at: Date | string;
}

/**
 * Persists single-use TFA recovery codes.
 *
 * Only hashes are stored. A code is removed after it is redeemed, so a
 * leaked list cannot be replayed.
 */
export class TfaRecoveryCodeRepository {
    constructor(
        private readonly db: DatabaseExecutor = defaultDb,
    ) {
    }

    async createMany(
        userId: number,
        codeHashes: string[],
        executor: DatabaseExecutor = this.db,
    ): Promise<void> {
        if (codeHashes.length === 0) {
            return;
        }

        await executor
            .insertInto(TFA_RECOVERY_CODE_TABLE)
            .values(
                codeHashes.map((codeHash) => ({
                    user_id: userId,
                    code_hash: codeHash,
                })),
            )
            .execute();
    }

    async findByUserId(
        userId: number,
        executor: DatabaseExecutor = this.db,
    ): Promise<TfaRecoveryCode[]> {
        return executor
            .selectFrom(TFA_RECOVERY_CODE_TABLE)
            .selectAll()
            .where("user_id", "=", userId)
            .orderBy("id", "asc")
            .execute();
    }

    async deleteById(
        id: number,
        executor: DatabaseExecutor = this.db,
    ): Promise<boolean> {
        const result = await executor
            .deleteFrom(TFA_RECOVERY_CODE_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }

    async deleteAllByUserId(
        userId: number,
        executor: DatabaseExecutor = this.db,
    ): Promise<number> {
        const result = await executor
            .deleteFrom(TFA_RECOVERY_CODE_TABLE)
            .where("user_id", "=", userId)
            .executeTakeFirst();

        return Number(result.numDeletedRows);
    }
}
