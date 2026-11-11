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
exports.SettingService = void 0;
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
class SettingService {
    constructor(settingRepository, redisCache) {
        this.settingRepository = settingRepository;
        this.redisCache = redisCache;
        this.localCache = null;
        this.localCacheExpiresAt = 0;
        this.DEFAULT_TTL = 3600; // 1 hour
    }
    updateLocalMemory(settings) {
        this.localCache = settings;
        this.localCacheExpiresAt = Date.now() + this.DEFAULT_TTL * 1000;
    }
    /**
     * Safe getter: Returns deeply frozen settings.
     * Resolves: Local Memory (L1) -> Redis Cache (L2) -> Database (L3)
     */
    getCache() {
        return __awaiter(this, void 0, void 0, function* () {
            // Check Local Memory Cache (L1)
            if (this.localCache && this.localCacheExpiresAt > Date.now()) {
                return Object.freeze(this.localCache);
            }
            // The L1 entry expired: fall through to L2/L3.
            this.localCache = null;
            this.localCacheExpiresAt = 0;
            // If Redis is connected, attempt to fetch from Redis (L2)
            if (this.redisCache.isConnected()) {
                try {
                    const cachedData = yield this.redisCache.get(SettingService.CACHE_KEY);
                    if (cachedData) {
                        this.localCache = cachedData;
                        this.localCacheExpiresAt = Date.now() + this.DEFAULT_TTL * 1000;
                        return Object.freeze(this.localCache);
                    }
                }
                catch (error) {
                    console.error("Failed to read from Redis cache, falling back to DB:", error);
                }
            }
            // Fallback to Database (L3) and warm caches
            return Object.freeze(yield this.boot());
        });
    }
    /**
     * Rebuilds the cache from the database and updates both Local and Redis layers.
     */
    boot() {
        return __awaiter(this, void 0, void 0, function* () {
            const freshSettings = yield this.initializer();
            // Warm L1 Cache
            this.localCache = freshSettings;
            this.localCacheExpiresAt = Date.now() + this.DEFAULT_TTL * 1000;
            // Warm L2 Cache asynchronously to optimize thread performance
            if (this.redisCache.isConnected()) {
                this.redisCache.set(SettingService.CACHE_KEY, freshSettings, this.DEFAULT_TTL).catch((err) => {
                    console.error("Failed to sync fresh settings to Redis:", err);
                });
            }
            return freshSettings;
        });
    }
    /**
     * Coordinates private and public DB settings retrieval in parallel.
     */
    initializer() {
        return __awaiter(this, void 0, void 0, function* () {
            const [privateSettings, publicSettings] = yield Promise.all([
                this.value([], undefined), // Private settings
                this.value([], true) // Public settings
            ]);
            return {
                pri: privateSettings,
                pub: publicSettings,
            };
        });
    }
    /**
     * Fetches settings from the database and parses them safely.
     */
    value() {
        return __awaiter(this, arguments, void 0, function* (slugs = [], is_public) {
            try {
                const settings = yield this.settingRepository.findBySlug(slugs, is_public);
                return this.parser(settings);
            }
            catch (error) {
                console.error(`Database retrieval failed for is_public=${is_public}:`, error);
                throw new Error("Unable to fetch configuration settings from database.", { cause: error });
            }
        });
    }
    /**
     * Safe runtime type parser. Prevents type confusion and guarantees clean fallbacks.
     */
    parser(settings) {
        // 1. Declare parsedObj as Partial so keys can be omitted initially
        const parsedObj = {};
        // Fallback: If no settings, we assert the empty object as SettingKeyValue
        // or you can return a default configuration object.
        if (!settings || !settings.length) {
            return parsedObj;
        }
        for (const setting of settings) {
            const { slug, type, value } = setting;
            if (!slug) {
                continue;
            }
            // Cast key to keyof SettingKeyValue so TS allows dynamic assignment
            const key = slug;
            if (value === null || value === undefined) {
                parsedObj[key] = type === "array" ? [] : type === "boolean" ? 0 : null;
                continue;
            }
            switch (type) {
                case "integer":
                    parsedObj[key] = parseInt(value, 10) || 0;
                    break;
                case "float":
                    parsedObj[key] = parseFloat(value) || 0;
                    break;
                case "boolean": {
                    const intVal = parseInt(value, 10);
                    parsedObj[key] = intVal === 1 || value === "true" ? 1 : 0;
                    break;
                }
                case "array":
                    parsedObj[key] = value.split(",");
                    break;
                default:
                    parsedObj[key] = value;
            }
        }
        // 2. Safely cast the fully built object to SettingKeyValue on return
        return parsedObj;
    }
    /**
     * Evicts the local memory cache (triggered by pub/sub when settings change).
     */
    clearLocalCache() {
        this.localCache = null;
    }
    createSetting(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = yield this.settingRepository.create(data);
            // update the local cache and publish newly created setting
            yield this.boot();
            return setting;
        });
    }
    updateSetting(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = yield this.settingRepository.update(id, data);
            if (!setting) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            // Update the local cache and publish the updated setting.
            yield this.boot();
            return setting;
        });
    }
    browseSettings(filters) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const MAX_PER_PAGE = 100;
            const page = Math.max(1, filters.page || 1);
            const perPage = Math.min(MAX_PER_PAGE, Math.max(1, filters.perPage || 20));
            const normalizedFilters = Object.assign(Object.assign({}, filters), { page,
                perPage, search: ((_a = filters.search) === null || _a === void 0 ? void 0 : _a.trim()) || undefined });
            return this.settingRepository.browse(normalizedFilters);
        });
    }
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const setting = yield this.settingRepository.findById(id);
            if (!setting) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            return setting;
        });
    }
    hardDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.settingRepository.hardDelete(id))) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            // Update the local cache and publish the updated setting.
            yield this.boot();
        });
    }
}
exports.SettingService = SettingService;
// Made CACHE_KEY public static so it is easily exportable/importable
SettingService.CACHE_KEY = "app:settings";
