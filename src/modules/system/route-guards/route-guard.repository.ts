// src/modules/system/route-guards/route-guard.repository.ts
import {db as defaultDb, type DatabaseExecutor} from "../../../config/database";
import {BrowseRouteGuardQuery, CreateRouteGuardDTO, RouteGuard, RouteGuardRow,} from "./route-guard.interface";
import {ROLE_TABLE} from "../roles/role.repository";

export const ROUTE_GUARD_TABLE = "route_guards";

const JOINED_COLUMNS = [
    "route_guards.id",
    "route_guards.role_id",
    "route_guards.route",
    "route_guards.created_at",
    "route_guards.updated_at",
    "roles.slug as role_slug",
] as const;

export class RouteGuardRepository {
    private readonly db: DatabaseExecutor;

    constructor(db: DatabaseExecutor = defaultDb) {
        this.db = db;
    }

    /**
     * Base query for route guards that require role information.
     *
     * Keeping the join in one place prevents the same join and
     * select list from being duplicated across repository methods.
     */
    private joinedQuery() {
        return this.db
            .selectFrom(ROUTE_GUARD_TABLE)
            .innerJoin(ROLE_TABLE, `${ROLE_TABLE}.id`, `${ROUTE_GUARD_TABLE}.role_id`)
            .select(JOINED_COLUMNS);
    }

    async create(data: CreateRouteGuardDTO): Promise<RouteGuard> {
        return this.db
            .insertInto(ROUTE_GUARD_TABLE)
            .values({
                role_id: data.role_id,
                route: data.route,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
    }

    async browse(
        filters: BrowseRouteGuardQuery,
    ): Promise<RouteGuardRow[]> {
        const {
            role_id,
            page,
            perPage,
        } = filters;

        const offset = (page - 1) * perPage;

        let query = this.joinedQuery();

        if (role_id !== undefined) {
            query = query.where(
                `${ROUTE_GUARD_TABLE}.role_id`,
                "=",
                role_id,
            );
        }

        return query
            .orderBy(
                `${ROUTE_GUARD_TABLE}.id`,
                "desc",
            )
            .offset(offset)
            .limit(perPage)
            .execute();
    }

    /**
     * Fetches all route guards with their role slugs.
     *
     * Used to build the authorization cache.
     */
    async findRouteGuardsGroupedByRole(): Promise<RouteGuardRow[]> {
        return this.joinedQuery().execute();
    }

    async findById(id: number): Promise<RouteGuardRow | null> {
        const row = await this.joinedQuery()
            .where(`${ROUTE_GUARD_TABLE}.id`, "=", id)
            .executeTakeFirst();

        return row ?? null;
    }

    async delete(id: number): Promise<boolean> {
        const result = await this.db
            .deleteFrom(ROUTE_GUARD_TABLE)
            .where("id", "=", id)
            .executeTakeFirst();

        return Number(result.numDeletedRows) > 0;
    }
}
