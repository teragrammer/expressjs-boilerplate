"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteGuardService = void 0;
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
class RouteGuardService {
    constructor(routeGuardRepository, redisCache) {
        this.routeGuardRepository = routeGuardRepository;
        this.redisCache = redisCache;
        this.localCache = null;
        this.DEFAULT_TTL = 3600; // 1 Hour
    }
    updateLocalMemory(guards) {
        this.localCache = guards;
    }
    /**
     * Safe getter: Returns deep-frozen route mappings.
     * Resolves: Local Memory (L1) -> Redis Cache (L2) -> Database (L3)
     */
    getCache() {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Check Local Memory Cache (L1)
            if (this.localCache) {
                return Object.freeze(this.localCache);
            }
            // 2. If Redis is connected, attempt to fetch from Redis (L2)
            if (this.redisCache.isConnected()) {
                try {
                    const cached = yield this.redisCache.get(RouteGuardService.CACHE_KEY);
                    if (cached) {
                        this.localCache = cached;
                        return Object.freeze(this.localCache);
                    }
                }
                catch (error) {
                    console.error("Redis error reading route guards, falling back to DB:", error);
                }
            }
            // 3. Fallback to Database (L3) and warm caches
            return Object.freeze(yield this.boot());
        });
    }
    /**
     * Boots/rebuilds L1 and L2 cache from the DB.
     */
    boot() {
        return __awaiter(this, void 0, void 0, function* () {
            const freshGuards = yield this.initializer();
            // Warm L1 Cache
            this.localCache = freshGuards;
            // Warm L2 Cache asynchronously to optimize performance
            if (this.redisCache.isConnected()) {
                this.redisCache.set(RouteGuardService.CACHE_KEY, freshGuards, this.DEFAULT_TTL).catch((err) => {
                    console.error("Failed to update route guards in Redis:", err);
                });
            }
            return freshGuards;
        });
    }
    /**
     * Aggregates and restructures database flat rows into optimized lookups.
     */
    initializer() {
        return __awaiter(this, void 0, void 0, function* () {
            const guards = {};
            const rows = yield this.routeGuardRepository.findRouteGuardsGroupedByRole();
            for (const row of rows) {
                const { role_slug, route } = row;
                if (!role_slug) {
                    continue;
                }
                if (!guards[role_slug]) {
                    guards[role_slug] = [];
                }
                guards[role_slug].push(route);
            }
            return guards;
        });
    }
    /**
     * Resets local state (triggered by pub/sub notifications when route guards change)
     */
    clearLocalCache() {
        this.localCache = null;
    }
    createRouteGuard(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const routeGuard = yield this.routeGuardRepository.create(data);
            yield this.boot();
            return routeGuard;
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const role = yield this.routeGuardRepository.findById(id);
            if (!role) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            return role;
        });
    }
    browseRouteGuards(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            const MAX_PER_PAGE = 100;
            const page = Math.max(1, filters.page || 1);
            const perPage = Math.min(MAX_PER_PAGE, Math.max(1, filters.perPage || 20));
            const normalizedFilters = Object.assign(Object.assign({}, filters), { page,
                perPage });
            return this.routeGuardRepository.browse(normalizedFilters);
        });
    }
    hardDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const deleted = yield this.routeGuardRepository.delete(id);
            if (!deleted) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            yield this.boot();
        });
    }
}
exports.RouteGuardService = RouteGuardService;
// Made CACHE_KEY public static so it is easily exportable/importable
RouteGuardService.CACHE_KEY = "app:route_guards";
