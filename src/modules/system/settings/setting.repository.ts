// src/modules/system/settings/setting.repository.ts
import type {Selectable} from "kysely";
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import type {Database} from "../../../config/schema";
import {
    BrowseSettingQuery,
    CreateSettingDTO,
    Setting,
    UpdateSettingDTO,
} from "./setting.interface";

export const SETTING_TABLE = "settings";

const SETTING_COLUMNS = [
    "id",
    "name",
    "slug",
    "value",
    "description",
    "type",
    "is_disabled",
    "is_public",
    "created_at",
    "updated_at",
] as const;

type SettingTableRow = Selectable<Database["settings"]>;

/**
 * Escapes PostgreSQL LIKE wildcards so free-text search can never
 * change the meaning of the pattern.
 */
function escapeLikePattern(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

export class SettingRepository {
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
    private mapToSetting(row: SettingTableRow): Setting {
        return {
            ...row,
            is_disabled: Boolean(row.is_disabled),
            is_public: Boolean(row.is_public),
        };
    }

    /**
     * Retrieves active settings filtered by slugs and visibility.
     */
    async findBySlug(
        slugs: string[] = [],
        is_public?: boolean,
    ): Promise<Setting[]> {
        let query = this.db
            .selectFrom(SETTING_TABLE)
            .selectAll()
            .where("is_disabled", "=", false);

        if (is_public !== undefined) {
            query = query.where("is_public", "=", is_public);
        }

        if (slugs.length > 0) {
            query = query.where("slug", "in", slugs);
        }

        const rows = await query.execute();

        return rows.map(row => this.mapToSetting(row));
    }

    /**
     * Creates a new setting.
     *
     * PostgreSQL RETURNING returns the inserted row in one round trip.
     */
    async create(data: CreateSettingDTO): Promise<Setting> {
        const newRow = await this.db
            .insertInto(SETTING_TABLE)
            .values({
                name: data.name,
                slug: data.slug,
                value: data.value,
                description: data.description,
                type: data.type,
                is_disabled: data.is_disabled ?? false,
                is_public: data.is_public ?? true,
            })
            .returningAll()
            .executeTakeFirstOrThrow();

        return this.mapToSetting(newRow);
    }

    async update(
        id: number,
        data: UpdateSettingDTO,
    ): Promise<Setting | null> {
        const updatedRow = await this.db
            .updateTable(SETTING_TABLE)
            .set({
                ...(data.name !== undefined && {
                    name: data.name,
                }),
                ...(data.slug !== undefined && {
                    slug: data.slug,
                }),
                ...(data.value !== undefined && {
                    value: data.value,
                }),
                ...(data.description !== undefined && {
                    description: data.description,
                }),
                ...(data.type !== undefined && {
                    type: data.type,
                }),
                ...(data.is_disabled !== undefined && {
                    is_disabled: data.is_disabled,
                }),
                ...(data.is_public !== undefined && {
                    is_public: data.is_public,
                }),
                updated_at: new Date(),
            })
            .where("id", "=", id)
            .returningAll()
            .executeTakeFirst();

        return updatedRow
            ? this.mapToSetting(updatedRow)
            : null;
    }

    async browse(
        filters: BrowseSettingQuery,
    ): Promise<Setting[]> {
        const {
            is_disabled,
            is_public,
            type,
            search,
            page,
            perPage,
        } = filters;

        const offset = (page - 1) * perPage;

        let query = this.db
            .selectFrom(SETTING_TABLE)
            .select(SETTING_COLUMNS);

        if (is_disabled !== undefined) {
            query = query.where("is_disabled", "=", is_disabled);
        }

        if (is_public !== undefined) {
            query = query.where("is_public", "=", is_public);
        }

        if (type !== undefined) {
            query = query.where("type", "=", type);
        }

        if (search !== undefined && search.length > 0) {
            const keyword = `%${escapeLikePattern(search)}%`;

            query = query.where((eb) => eb.or([
                eb("name", "like", keyword),
                eb("slug", "like", keyword),
                eb("value", "like", keyword),
            ]));
        }

        const rows = await query
            .orderBy("id", "desc")
            .offset(offset)
            .limit(perPage)
            .execute();

        return rows.map(row => this.mapToSetting(row));
    }

    async findById(id: number): Promise<Setting | null> {
        const row = await this.db
            .selectFrom(SETTING_TABLE)
            .select(SETTING_COLUMNS)
            .where("id", "=", id)
            .executeTakeFirst();

        return row
            ? this.mapToSetting(row)
            : null;
    }

    async hardDelete(id: number): Promise<boolean> {
        const result = await this.db
            .deleteFrom(SETTING_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }
}
