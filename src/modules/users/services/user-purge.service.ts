// src/modules/users/services/user-purge.service.ts
import {Request} from "express";
import {UserRepository} from "../user.repository";
import {AuthenticationTokenRepository} from "../../auth/authentication/authentication-token.repository";
import {AuditService} from "../../audit/audit.service";
import {AUDIT_ACTIONS} from "../../audit/audit.interface";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {Actor} from "../../../common/authz/policy";
import {type TransactionRunner} from "../services/user.service";
import {withTransaction} from "../../../config/database";

/**
 * Roles allowed to permanently remove a user.
 *
 * The hard delete destroys the account row and its history, so it is
 * reserved for a super-admin and always leaves an audit record.
 */
const PURGE_ROLES = new Set(["admin"]);

/**
 * Permanently removes a user.
 *
 * The standard delete endpoint performs a soft delete. This operation
 * is destructive: it requires a privileged role, a stated reason, and
 * it produces an audit event.
 */
export class UserPurgeService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly auditService: AuditService,
        private readonly runInTransaction: TransactionRunner = withTransaction,
    ) {
    }

    /**
     * Permanently deletes a user.
     *
     * @param reason why the account is being removed; recorded in the
     * audit trail.
     */
    async purge(
        id: number,
        actor: Actor,
        reason: string,
        request?: Request,
    ): Promise<void> {
        if (!PURGE_ROLES.has(actor.roleSlug) && !actor.bypass) {
            throw new AppError(
                Messages.NO_PERMISSION,
                "Permanently removing an account requires an administrator.",
            );
        }

        const trimmedReason = reason?.trim() ?? "";

        if (trimmedReason.length < 10) {
            throw new AppError(
                Messages.INVALID_REQUEST,
                "A reason of at least 10 characters is required to remove an account permanently.",
            );
        }

        const user = await this.userRepository.findAuthById(id);

        if (!user) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        // Revoke the sessions before the row disappears.
        await this.runInTransaction(async (trx) => {
            await this.authenticationTokenRepository.deleteAllByUserId(
                id,
                undefined,
                trx,
            );

            await this.userRepository.hardDelete(id, trx);
        });

        await this.auditService.success(AUDIT_ACTIONS.USER_DELETED, {
            request,
            actorUserId: actor.id,
            targetType: "user",
            targetId: id,
            metadata: {
                reason: trimmedReason,
                permanent: true,
            },
        });
    }
}
