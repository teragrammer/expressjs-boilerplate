// src/modules/users/user.service.ts
import {UserRepository} from "../user.repository";
import {BrowseUsersQuery, BrowseUsersResult, CreateUserDTO, UpdateUserDTO, User} from "../user.interface";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {SecurityUtil} from "../../../common/utils/security.util";
import {
    type DatabaseExecutor,
    withTransaction,
} from "../../../config/database";
import type {Transaction} from "kysely";
import type {Database} from "../../../config/schema";
import {
    Actor,
    assertCanChangePrivilegedFields,
} from "../../../common/authz/policy";
import {AuthenticationTokenRepository} from "../../auth/authentication/authentication-token.repository";

/**
 * Runs a callback inside a database transaction.
 */
export type TransactionRunner = <T>(
    callback: (trx: Transaction<Database>) => Promise<T>,
) => Promise<T>;

/**
 * Roles that may read any user record.
 */
const ADMINISTRATIVE_ROLES = new Set(["admin", "manager"]);

export class UserService {
    // Dependency injection allows passing a mock repository during testing
    constructor(
        private userRepository: UserRepository,
        private readonly securityUtil: SecurityUtil,
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly runInTransaction: TransactionRunner = withTransaction,
    ) {
    }

    /**
     * Handles business logic for creating a user under registration form
     *
     * An optional executor allows the caller to run the insert inside a
     * surrounding transaction (registration creates a user and a session
     * atomically).
     */
    async registerUser(
        data: CreateUserDTO,
        executor?: DatabaseExecutor,
    ): Promise<User> {
        // Check if email already exists
        if (data.email) {
            const existingEmail = await this.userRepository.findByEmail(data.email);
            if (existingEmail) {
                throw new AppError(
                    Messages.DUPLICATE_DATA,
                    "Duplicate email already exists"
                );
            }
        }

        // Check if phone already exists
        if (data.phone) {
            const existingPhone = await this.userRepository.findByPhone(data.phone);
            if (existingPhone) {
                throw new AppError(
                    Messages.DUPLICATE_DATA,
                    "Duplicate phone number already exists",
                );
            }
        }

        // Create and return the user
        return this.userRepository.create(data, executor);
    }

    async createUser(
        data: CreateUserDTO,
        actor?: Actor,
    ): Promise<User> {
        /*
         * Privileged fields (role, status, password) may only be set
         * by an administrator. The check lives in the service so every
         * entry point is covered, not only the HTTP route.
         */
        if (actor) {
            assertCanChangePrivilegedFields(
                actor,
                Object.keys(data as unknown as Record<string, unknown>),
            );
        }

        if (data.password !== null && typeof data.password !== "undefined") {
            data.password = await this.securityUtil.hash(data.password);
        }

        const user: User | null = await this.userRepository.create(data);
        if (!user) {throw new AppError(Messages.SERVER_ERROR);}

        return user;
    }

    async updateUser(
        id: number,
        data: UpdateUserDTO,
        actor?: Actor,
    ): Promise<User> {
        if (actor) {
            assertCanChangePrivilegedFields(
                actor,
                Object.keys(data as unknown as Record<string, unknown>),
            );
        }

        // First check current user to compare role_id and status
        const currentUser = await this.userRepository.findAuthById(id);
        if (!currentUser) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        // Check if role_id or status is being changed to increment authorization_version
        const roleChanged = data.role_id !== undefined && data.role_id !== currentUser.role_id;
        const statusChanged = data.status !== undefined && data.status !== currentUser.status;
        
        if (roleChanged || statusChanged) {
            data.authorization_version = (currentUser.authorization_version || 0) + 1;
        }

        // Hash password if provided
        if (data.password !== null && typeof data.password !== "undefined") {
            data.password = await this.securityUtil.hash(data.password);
        }

        if (!roleChanged && !statusChanged) {
            const user: User | null = await this.userRepository.update(id, data);

            if (!user) {throw new AppError(Messages.DATA_NOT_FOUND);}

            return user;
        }

        /*
         * A role or status change must take effect immediately: the
         * sessions of the affected user are revoked so the old
         * permissions cannot be used until the next login.
         *
         * The update and the revocation happen in one transaction, so
         * a failure cannot leave a user with new permissions and a live
         * session.
         */
        return this.runInTransaction(async (trx) => {
            const updated = await this.userRepository.update(
                id,
                data,
                undefined,
                trx,
            );

            if (!updated) {
                throw new AppError(Messages.DATA_NOT_FOUND);
            }

            await this.authenticationTokenRepository.deleteAllByUserId(
                id,
                undefined,
                trx,
            );

            return updated;
        });
    }

    async browseUsers(
        query: BrowseUsersQuery
    ): Promise<BrowseUsersResult> {
        return this.userRepository.browse(query);
    }

    /**
     * Resolves a user profile by its unique ID for authentication context mapping.
     */
    async findById(id: number, actor?: Actor): Promise<User> {
        /*
         * The object-level rule: an actor without administrative
         * visibility may only read their own record. The route guard
         * has already been checked by the middleware; this closes the
         * gap between "may read a user" and "may read this user".
         */
        if (
            actor &&
            !actor.bypass &&
            !ADMINISTRATIVE_ROLES.has(actor.roleSlug) &&
            id !== actor.id
        ) {
            throw new AppError(
                Messages.NO_PERMISSION,
                "You may only read your own account.",
            );
        }

        const user: User | null = await this.userRepository.findById(id);
        if (!user) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }
        return user;
    }

    /**
     * Internal lookup that may include sensitive fields (e.g. password).
     * Never return this directly from a controller.
     */
    async findAuthById(id: number): Promise<User> {
        const user: User | null = await this.userRepository.findAuthById(id);
        if (!user) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }
        return user;
    }

    /**
     * Soft-deletes a user and revokes its sessions.
     *
     * The row is kept (with `deleted_at` set) so the account history
     * and the audit trail stay intact, and every session is revoked so
     * the deleted account cannot keep using an existing token.
     */
    async softDelete(id: number): Promise<void> {
        const user = await this.userRepository.findAuthById(id);

        if (!user) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        await this.runInTransaction(async (trx) => {
            await this.userRepository.softDelete(id, trx);
            await this.authenticationTokenRepository.deleteAllByUserId(
                id,
                undefined,
                trx,
            );
        });
    }

    async hardDelete(id: number): Promise<void> {
        if (!await this.userRepository.hardDelete(id)) {
            throw new AppError(Messages.DELETE_FAILED);
        }
    }
}