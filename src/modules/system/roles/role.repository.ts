// src/modules/system/roles/role.repository.ts
import {sql, type Kysely, type Selectable} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import type {Database} from "../../../config/schema";
import {
    BrowseRoleQuery,
    CreateRoleDTO,
    Role,
    UpdateRoleDTO,
} from "./role.interface";
import {escapeLikePattern} from "../../../common/utils/sql-like";

export const ROLE_TABLE = "roles";

const ROLE_COLUMNS = [
    "id",
    "name",
    "slug",
    "description",
    "is_public",
    "is_bypass_authorization",
    "created_at",
    "updated_at",
] as const;

type RoleTableRow = Selectable<Database["roles"]>;

export class RoleRepository {
    private readonly db: DatabaseExecutor;

    /**
     * Constructor defaults to the application's database instance,
     * but allows dependency injection for tests.
     */
    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    /**
     * Convert a database row into the application/domain representation.
     */
    private mapToRole(row: RoleTableRow): Role {
        return {
            ...row,
            is_public: Boolean(row.is_public),
            is_bypass_authorization: Boolean(row.is_bypass_authorization),
        };
    }

    async findById(id: number): Promise<Role | null> {
        const row = await this.db
            .selectFrom(ROLE_TABLE)
            .select(ROLE_COLUMNS)
            .where("id", "=", id)
            .executeTakeFirst();

        return row
            ? this.mapToRole(row)
            : null;
    }

    async findBySlug(slug: string): Promise<Role | null> {
        const row = await this.db
            .selectFrom(ROLE_TABLE)
            .selectAll()
            .where("slug", "=", slug)
            .executeTakeFirst();

        return row
            ? this.mapToRole(row)
            : null;
    }

    async create(data: CreateRoleDTO): Promise<Role> {
        const newRow = await this.db
            .insertInto(ROLE_TABLE)
            .values({
                name: data.name,
                slug: data.slug,
                description: data.description || null,
                is_public: data.is_public ?? false,
                is_bypass_authorization: data.is_bypass_authorization ?? false,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return this.mapToRole(newRow);
    }

    async update(
        id: number,
        data: UpdateRoleDTO,
        executor?: DatabaseExecutor,
    ): Promise<Role | null> {
        const updateRole = async (
            db: DatabaseExecutor,
        ): Promise<Role | null> => {
            const existing = await db
                .selectFrom(ROLE_TABLE)
                .selectAll()
                .where("id", "=", id)
                .executeTakeFirst();

            if (!existing) {
                return null;
            }

            const updatedRow = await db
                .updateTable(ROLE_TABLE)
                .set({
                    ...(data.name !== undefined && {
                        name: data.name,
                    }),
                    ...(data.slug !== undefined && {
                        slug: data.slug,
                    }),
                    ...(data.description !== undefined && {
                        description: data.description || null,
                    }),
                    ...(data.is_public !== undefined && {
                        is_public: data.is_public,
                    }),
                    ...(data.is_bypass_authorization !== undefined && {
                        is_bypass_authorization: data.is_bypass_authorization,
                    }),
                    updated_at: new Date(),
                })
                .where("id", "=", id)
                .returningAll()
                .executeTakeFirst();

            if (!updatedRow) {
                return null;
            }

            /*
             * The bypass flag and the role slug are embedded in issued
             * access tokens. A change to either must invalidate the
             * tokens of every user assigned to the role, not only
             * future logins.
             */
            const securityChanged =
                (data.is_bypass_authorization !== undefined &&
                    Boolean(data.is_bypass_authorization) !==
                        Boolean(existing.is_bypass_authorization)) ||
                (data.slug !== undefined && data.slug !== existing.slug);

            if (securityChanged) {
                const users = await db
                    .selectFrom("users")
                    .select("id")
                    .where("role_id", "=", id)
                    .execute();

                const userIds = users.map((user) => user.id);

                if (userIds.length > 0) {
                    await db
                        .updateTable("users")
                        .set({
                            authorization_version:
                                sql<number>`authorization_version + 1`,
                            updated_at: new Date(),
                        })
                        .where("id", "in", userIds)
                        .execute();

                    const tokens = await db
                        .selectFrom("authentication_tokens")
                        .select("id")
                        .where("user_id", "in", userIds)
                        .execute();

                    if (tokens.length > 0) {
                        await db
                            .deleteFrom("two_factor_authentications")
                            .where(
                                "token_id",
                                "in",
                                tokens.map((token) => token.id),
                            )
                            .execute();
                    }

                    await db
                        .deleteFrom("authentication_tokens")
                        .where("user_id", "in", userIds)
                        .execute();

                    await db
                        .updateTable("refresh_tokens")
                        .set({
                            revoked_at:
                                sql<Date>`COALESCE(revoked_at, now())`,
                            updated_at: new Date(),
                        })
                        .where("user_id", "in", userIds)
                        .where("revoked_at", "is", null)
                        .execute();
                }
            }

            return this.mapToRole(updatedRow);
        };

        if (executor) {
            return updateRole(executor);
        }

        return (this.db as Kysely<Database>)
            .transaction()
            .execute(updateRole);
    }

    async browse(
        filters: BrowseRoleQuery,
    ): Promise<Role[]> {
        const {
            is_public,
            search,
            page,
            perPage,
        } = filters;

        const offset = (page - 1) * perPage;

        let query = this.db
            .selectFrom(ROLE_TABLE)
            .select(ROLE_COLUMNS);

        if (is_public !== undefined) {
            query = query.where(
                "is_public",
                "=",
                is_public,
            );
        }

        if (search !== undefined && search.length > 0) {
            const keyword = `%${escapeLikePattern(search)}%`;

            query = query.where((eb) => eb.or([
                eb("name", "like", keyword),
                eb("slug", "like", keyword),
                eb("description", "like", keyword),
            ]));
        }

        const rows = await query
            .orderBy("id", "desc")
            .offset(offset)
            .limit(perPage)
            .execute();

        return rows.map(row => this.mapToRole(row));
    }

    /**
     * Counts the users assigned to a role.
     *
     * Used to block a role deletion while users still reference it.
     */
    async countUsers(roleId: number): Promise<number> {
        const row = await this.db
            .selectFrom("users")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .where("role_id", "=", roleId)
            .where("deleted_at", "is", null)
            .executeTakeFirst();

        return Number(row?.count ?? 0);
    }

    /**
     * Counts the route guards that reference a role.
     */
    async countRouteGuards(roleId: number): Promise<number> {
        const row = await this.db
            .selectFrom("route_guards")
            .select((eb) => eb.fn.countAll<number>().as("count"))
            .where("role_id", "=", roleId)
            .executeTakeFirst();

        return Number(row?.count ?? 0);
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.db
            .deleteFrom(ROLE_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }
}
