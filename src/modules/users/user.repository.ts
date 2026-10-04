// src/modules/users/user.repository.ts
import {sql, type Selectable} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../config/database";
import type {Transaction} from "kysely";
import type {Database} from "../../config/schema";
import {BrowseUsersQuery, BrowseUsersResult, CreateUserDTO, Status, UpdateUserDTO, User, UserRow,} from "./user.interface";

export const USER_TABLE = "users";

const USER_PUBLIC_COLUMNS = [
    "id",
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "address",
    "phone",
    "is_phone_verified",
    "email",
    "is_email_verified",
    "has_tfa",
    "role_id",
    "username",
    "status",
    "comments",
    "created_at",
    "updated_at",
] as const;

/**
 * Escapes PostgreSQL LIKE wildcards so free-text search can never
 * change the meaning of the pattern.
 */
function escapeLikePattern(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

type UserTableRow = Selectable<Database["users"]>;

export class UserRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    private mapToUser(row: UserTableRow): User {
        return {
            ...row,
            is_phone_verified: Boolean(row.is_phone_verified),
            is_email_verified: Boolean(row.is_email_verified),
            has_tfa: Boolean(row.has_tfa),
        } as User;
    }

    private activeUsers() {
        return this.db
            .selectFrom(USER_TABLE)
            .selectAll()
            .where("deleted_at", "is", null);
    }

    async findById(id: number): Promise<User | null> {
        const row = await this.activeUsers()
            .where("id", "=", id)
            .executeTakeFirst();

        return row ? this.mapToUser(row) : null;
    }

    async findByEmail(email: string): Promise<User | null> {
        const row = await this.activeUsers()
            .where("email", "=", email)
            .executeTakeFirst();

        return row ? this.mapToUser(row) : null;
    }

    async findByPhone(phone: string): Promise<User | null> {
        const row = await this.activeUsers()
            .where("phone", "=", phone)
            .executeTakeFirst();

        return row ? this.mapToUser(row) : null;
    }

    async findByUsername(username: string): Promise<User | null> {
        const row = await this.activeUsers()
            .where("username", "=", username)
            .executeTakeFirst();

        return row ? this.mapToUser(row) : null;
    }

    async create(data: CreateUserDTO): Promise<User> {
        const newRow = await this.db
            .insertInto(USER_TABLE)
            .values({
                first_name: data.first_name || null,
                middle_name: data.middle_name || null,
                last_name: data.last_name || null,
                gender: data.gender || null,
                address: data.address || null,
                phone: data.phone || null,
                is_phone_verified: false,
                email: data.email || null,
                is_email_verified: false,
                has_tfa: false,
                role_id: data.role_id,
                username: data.username || null,
                password: data.password || null,
                status: data.status || "Activated",
                login_tries: 0,
                failed_login_expired_at: null,
                comments: data.comments || null,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return this.mapToUser(newRow);
    }

    async update(
        id: number,
        data: UpdateUserDTO,
        status?: Status,
    ): Promise<User | null> {
        const existingRow = await this.activeUsers()
            .select("id")
            .where("id", "=", id)
            .executeTakeFirst();

        if (!existingRow) {
            return null;
        }

        let query = this.db
            .updateTable(USER_TABLE)
            .set({
                ...(data.first_name !== undefined && {
                    first_name: data.first_name,
                }),
                ...(data.middle_name !== undefined && {
                    middle_name: data.middle_name,
                }),
                ...(data.last_name !== undefined && {
                    last_name: data.last_name,
                }),
                ...(data.gender !== undefined && {
                    gender: data.gender,
                }),
                ...(data.address !== undefined && {
                    address: data.address,
                }),
                ...(data.phone !== undefined && {
                    phone: data.phone,
                }),
                ...(data.is_phone_verified !== undefined && {
                    is_phone_verified: data.is_phone_verified,
                }),
                ...(data.email !== undefined && {
                    email: data.email,
                }),
                ...(data.is_email_verified !== undefined && {
                    is_email_verified: data.is_email_verified,
                }),
                ...(data.has_tfa !== undefined && {
                    has_tfa: data.has_tfa,
                }),
                ...(data.tfa_secret !== undefined && {
                    tfa_secret: data.tfa_secret,
                }),
                ...(data.role_id !== undefined && {
                    role_id: data.role_id,
                }),
                ...(data.username !== undefined && {
                    username: data.username,
                }),
                ...(data.password !== undefined && {
                    password: data.password,
                }),
                ...(data.status !== undefined && {
                    status: data.status,
                }),
                ...(data.login_tries !== undefined && {
                    login_tries: data.login_tries,
                }),
                ...(data.failed_login_expired_at !== undefined && {
                    failed_login_expired_at: data.failed_login_expired_at,
                }),
                ...(data.comments !== undefined && {
                    comments: data.comments,
                }),
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .where("deleted_at", "is", null);

        if (status !== undefined) {
            query = query.where("status", "=", status);
        }

        const updatedRow = await query
            .returningAll()
            .executeTakeFirst();

        return updatedRow
            ? this.mapToUser(updatedRow)
            : null;
    }

    /**
     * Cursor-based user browsing.
     *
     * Uses the primary key for stable and efficient pagination:
     *
     * WHERE id < cursor
     * ORDER BY id DESC
     * LIMIT limit + 1
     *
     * No COUNT(*) and no OFFSET are required.
     */
    async browse(
        query: BrowseUsersQuery,
    ): Promise<BrowseUsersResult> {
        const {
            role_id,
            status,
            search,
            cursor,
            limit,
        } = query;

        let baseQuery = this.db
            .selectFrom(USER_TABLE)
            .select(USER_PUBLIC_COLUMNS)
            .where("deleted_at", "is", null);

        if (role_id !== undefined) {
            baseQuery = baseQuery.where("role_id", "=", role_id);
        }

        if (status !== undefined) {
            baseQuery = baseQuery.where("status", "=", status);
        }

        if (cursor !== undefined) {
            baseQuery = baseQuery.where("id", "<", cursor);
        }

        if (search) {
            const keyword = `%${escapeLikePattern(search)}%`;

            baseQuery = baseQuery.where((eb) => eb.or([
                eb("first_name", "like", keyword),
                eb("middle_name", "like", keyword),
                eb("last_name", "like", keyword),
                eb("username", "like", keyword),
                eb("phone", "like", keyword),
                eb("email", "like", keyword),
            ]));
        }

        const rows = await baseQuery
            .orderBy("id", "desc")
            .limit(limit + 1)
            .execute();

        const hasMore = rows.length > limit;

        const data: User[] = rows
            .slice(0, limit)
            .map((row) => ({
                ...row,
                is_phone_verified: Boolean(row.is_phone_verified),
                is_email_verified: Boolean(row.is_email_verified),
                has_tfa: Boolean(row.has_tfa),
            })) as User[];

        const nextCursor =
            hasMore && data.length > 0
                ? data[data.length - 1].id
                : null;

        return {
            data,
            hasMore,
            nextCursor,
        };
    }

    async updatePassword(
        id: number,
        password: string,
        trx?: Transaction<Database>,
    ): Promise<boolean> {
        const executor: DatabaseExecutor = trx ?? this.db;

        const result = await executor
            .updateTable(USER_TABLE)
            .set({
                password,
                updated_at: sql<Date>`now()`,
            })
            .where("id", "=", id)
            .where("deleted_at", "is", null)
            .executeTakeFirst();

        return Number(result.numUpdatedRows) > 0;
    }

    async incrementLoginTries(
        id: number,
    ): Promise<User | null> {
        const updatedRow = await this.db
            .updateTable(USER_TABLE)
            .set({
                login_tries: sql<number>`login_tries + 1`,
                updated_at: sql<Date>`now()`,
            })
            .where("id", "=", id)
            .where("deleted_at", "is", null)
            .returningAll()
            .executeTakeFirst();

        return updatedRow
            ? this.mapToUser(updatedRow)
            : null;
    }

    async softDelete(id: number): Promise<boolean> {
        const result = await this.db
            .updateTable(USER_TABLE)
            .set({
                deleted_at: new Date(),
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .where("deleted_at", "is", null)
            .executeTakeFirst();

        return Number(result.numUpdatedRows) > 0;
    }

    async hardDelete(id: number): Promise<boolean> {
        const result = await this.db
            .deleteFrom(USER_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }
}

// Keeps the legacy raw-row export available for existing imports.
export type {UserRow};
