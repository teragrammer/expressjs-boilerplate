// src/modules/system/route-guards/route-guard.service.ts
import {RedisCache} from "../../../shared/redis/redis-cache";
import {RouteGuardRepository} from "./route-guard.repository";
import {
    BrowseRouteGuardQuery,
    CreateRouteGuardDTO,
    RouteGuard,
    RouteGuardCachePayload,
    RouteGuardRow
} from "./route-guard.interface";
import {AppError} from "../../../common/utils/errors";
import {SingleFlight} from "../../../common/utils/single-flight";
import {logger} from "../../../config/logger";
import Messages from "../../../common/utils/messages";

export class RouteGuardService {
    // Made CACHE_KEY public static so it is easily exportable/importable
    public static readonly CACHE_KEY = "app:route_guards";

    private localCache: RouteGuardCachePayload | null = null;
    private localCacheExpiresAt = 0;

    /**
     * Coalesces concurrent cache rebuilds so a cold start does not
     * make every worker query the database at once.
     */
    private readonly singleFlight = new SingleFlight();
    private readonly DEFAULT_TTL = 3600; // 1 Hour

    constructor(
        private readonly routeGuardRepository: RouteGuardRepository,
        private readonly redisCache: RedisCache
    ) {
    }

    updateLocalMemory(guards: any): void { // Replace 'any' with your actual Route Guard type if applicable
        this.localCache = guards;
        this.localCacheExpiresAt = Date.now() + this.DEFAULT_TTL * 1000;
    }

    /**
     * Safe getter: Returns deep-frozen route mappings.
     * Resolves: Local Memory (L1) -> Redis Cache (L2) -> Database (L3)
     */
    async getCache(): Promise<Readonly<RouteGuardCachePayload>> {
        // 1. Check Local Memory Cache (L1)
        if (this.localCache && this.localCacheExpiresAt > Date.now()) {
            return Object.freeze(this.localCache);
        }

        // The L1 entry expired: fall through to L2/L3.
        this.localCache = null;
        this.localCacheExpiresAt = 0;

        // 2. If Redis is connected, attempt to fetch from Redis (L2)
        if (this.redisCache.isConnected()) {
            try {
                const cached = await this.redisCache.get<RouteGuardCachePayload>(RouteGuardService.CACHE_KEY);
                if (cached) {
                    this.localCache = cached;
                    this.localCacheExpiresAt = Date.now() + this.DEFAULT_TTL * 1000;
                    return Object.freeze(this.localCache);
                }
            } catch (error) {
                logger.error(
                    {message: (error as Error).message},
                    "Redis error reading route guards, falling back to DB",
                );
            }
        }

        // 3. Fallback to Database (L3) and warm caches
        return Object.freeze(await this.boot());
    }

    /**
     * Boots/rebuilds L1 and L2 cache from the DB.
     */
    async boot(): Promise<RouteGuardCachePayload> {
        return this.singleFlight.run("route_guards", async () => {
            const freshGuards = await this.initializer();

            // Warm L1 Cache
            this.localCache = freshGuards;
            this.localCacheExpiresAt =
                Date.now() + this.DEFAULT_TTL * 1000;

            // Warm L2 Cache asynchronously to optimize performance
            if (this.redisCache.isConnected()) {
                this.redisCache
                    .set(
                        RouteGuardService.CACHE_KEY,
                        freshGuards,
                        this.DEFAULT_TTL,
                    )
                    .catch((err) => {
                        logger.error(
                            {message: (err as Error).message},
                            "Failed to update route guards in Redis",
                        );
                    });
            }

            return freshGuards;
        });
    }

    /**
     * Aggregates and restructures database flat rows into optimized lookups.
     */
    async initializer(): Promise<RouteGuardCachePayload> {
        const guards: RouteGuardCachePayload = {};
        const rows = await this.routeGuardRepository.findRouteGuardsGroupedByRole();

        for (const row of rows) {
            const {role_slug, route} = row;
            if (!role_slug) {continue;}

            if (!guards[role_slug]) {
                guards[role_slug] = [];
            }
            guards[role_slug].push(route);
        }

        return guards;
    }

    /**
     * Resets local state (triggered by pub/sub notifications when route guards change)
     */
    clearLocalCache(): void {
        this.localCache = null;
    }

    /**
     * Creates a route guard.
     *
     * The `(role_id, route)` pair is unique, so a duplicate grant is
     * rejected with a 409 rather than silently creating a second row.
     */
    async createRouteGuard(data: CreateRouteGuardDTO): Promise<RouteGuard> {
        const existing = await this.routeGuardRepository.findByRoleAndRoute(
            data.role_id,
            data.route,
        );

        if (existing) {
            throw new AppError(
                Messages.DUPLICATE_DATA,
                "This route is already granted to the role.",
            );
        }

        const routeGuard: RouteGuard =
            await this.routeGuardRepository.create(data);

        await this.boot();

        return routeGuard;
    }

    async findById(id: number): Promise<RouteGuardRow> {
        const role = await this.routeGuardRepository.findById(id);

        if (!role) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        return role;
    }

    async browseRouteGuards(
        filters: BrowseRouteGuardQuery,
    ): Promise<RouteGuardRow[]> {
        const MAX_PER_PAGE = 100;

        const page = Math.max(
            1,
            filters.page || 1,
        );

        const perPage = Math.min(
            MAX_PER_PAGE,
            Math.max(
                1,
                filters.perPage || 20,
            ),
        );

        const normalizedFilters: BrowseRouteGuardQuery = {
            ...filters,
            page,
            perPage,
        };

        return this.routeGuardRepository.browse(normalizedFilters);
    }

    async hardDelete(id: number): Promise<void> {
        const deleted = await this.routeGuardRepository.delete(id);

        if (!deleted) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        await this.boot();
    }
}