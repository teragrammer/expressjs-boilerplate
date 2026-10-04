// src/modules/system/roles/role.repository.ts
import type {Selectable} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import type {Database} from "../../../config/schema";
import {
    BrowseRoleQuery,
    CreateRoleDTO,
    Role,
    UpdateRoleDTO,
} from "./role.interface";

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

/**
 * Escapes PostgreSQL LIKE wildcards so free-text search can never
 * change the meaning of the pattern.
 */
function escapeLikePattern(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

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
    ): Promise<Role | null> {
        const updatedRow = await this.db
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

        return updatedRow
            ? this.mapToRole(updatedRow)
            : null;
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

    async delete(id: number): Promise<boolean> {
        const result = await this.db
            .deleteFrom(ROLE_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }
}
