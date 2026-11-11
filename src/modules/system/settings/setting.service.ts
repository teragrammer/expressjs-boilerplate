// src/modules/system/settings/setting.service.ts
import {
    BrowseSettingQuery,
    CreateSettingDTO,
    InitializerSetting,
    Setting,
    UpdateSettingDTO
} from "./setting.interface";
import {SettingRepository} from "./setting.repository";
import {RedisCache} from "../../../shared/redis/redis-cache";
import {SettingKeyValue} from "./setting-key-value.interface";
import {logger} from "../../../config/logger";
import {SingleFlight} from "../../../common/utils/single-flight";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";

export class SettingService {
    // Made CACHE_KEY public static so it is easily exportable/importable
    public static readonly CACHE_KEY = "app:settings";

    private localCache: InitializerSetting | null = null;
    private localCacheExpiresAt = 0;

    /**
     * Coalesces concurrent cache rebuilds so a cold start does not
     * make every worker query the database at once.
     */
    private readonly singleFlight = new SingleFlight();
    private readonly DEFAULT_TTL = 3600; // 1 hour

    constructor(
        private readonly settingRepository: SettingRepository,
        private readonly redisCache: RedisCache
    ) {
    }

    updateLocalMemory(settings: InitializerSetting): void {
        this.localCache = settings;
        this.localCacheExpiresAt = Date.now() + this.DEFAULT_TTL * 1000;
    }

    /**
     * Safe getter: Returns deeply frozen settings.
     * Resolves: Local Memory (L1) -> Redis Cache (L2) -> Database (L3)
     */
    async getCache(): Promise<Readonly<InitializerSetting>> {
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
                const cachedData = await this.redisCache.get<InitializerSetting>(SettingService.CACHE_KEY);
                if (cachedData) {
                    this.localCache = cachedData;
                    this.localCacheExpiresAt = Date.now() + this.DEFAULT_TTL * 1000;
                    return Object.freeze(this.localCache);
                }
            } catch (error) {
                logger.error(
                    {message: (error as Error).message},
                    "Failed to read from Redis cache, falling back to DB",
                );
            }
        }

        // Fallback to Database (L3) and warm caches
        return Object.freeze(await this.boot());
    }

    /**
     * Rebuilds the cache from the database and updates both Local and Redis layers.
     */
    async boot(): Promise<InitializerSetting> {
        return this.singleFlight.run("settings", async () => {
            const freshSettings = await this.initializer();

            // Warm L1 Cache
            this.localCache = freshSettings;
            this.localCacheExpiresAt =
                Date.now() + this.DEFAULT_TTL * 1000;

            // Warm L2 Cache asynchronously to optimize thread performance
            if (this.redisCache.isConnected()) {
                this.redisCache
                    .set(
                        SettingService.CACHE_KEY,
                        freshSettings,
                        this.DEFAULT_TTL,
                    )
                    .catch((err) => {
                        logger.error(
                            {message: (err as Error).message},
                            "Failed to sync fresh settings to Redis",
                        );
                    });
            }

            return freshSettings;
        });
    }

    /**
     * Coordinates private and public DB settings retrieval in parallel.
     */
    async initializer(): Promise<InitializerSetting> {
        const [privateSettings, publicSettings] = await Promise.all([
            this.value([], undefined), // Private settings
            this.value([], true)       // Public settings
        ]);

        return {
            pri: privateSettings,
            pub: publicSettings,
        };
    }

    /**
     * Fetches settings from the database and parses them safely.
     */
    async value(slugs: string[] = [], is_public?: boolean): Promise<SettingKeyValue> {
        try {
            const settings: Setting[] = await this.settingRepository.findBySlug(slugs, is_public);
            return this.parser(settings);
        } catch (error) {
            logger.error(
                {is_public, message: (error as Error).message},
                "Database retrieval failed",
            );
            throw new Error("Unable to fetch configuration settings from database.", { cause: error });
        }
    }

    /**
     * Safe runtime type parser. Prevents type confusion and guarantees clean fallbacks.
     */
    parser(settings: Setting[] | undefined): SettingKeyValue {
        // 1. Declare parsedObj as Partial so keys can be omitted initially
        const parsedObj: Partial<SettingKeyValue> = {};

        // Fallback: If no settings, we assert the empty object as SettingKeyValue
        // or you can return a default configuration object.
        if (!settings || !settings.length) {return parsedObj as SettingKeyValue;}

        for (const setting of settings) {
            const {slug, type, value} = setting;
            if (!slug) {continue;}

            // Cast key to keyof SettingKeyValue so TS allows dynamic assignment
            const key = slug as keyof SettingKeyValue;

            if (value === null || value === undefined) {
                (parsedObj[key] as any) = type === "array" ? [] : type === "boolean" ? 0 : null;
                continue;
            }

            switch (type) {
                case "integer":
                    (parsedObj[key] as any) = parseInt(value, 10) || 0;
                    break;
                case "float":
                    (parsedObj[key] as any) = parseFloat(value) || 0;
                    break;
                case "boolean": {
                    const intVal = parseInt(value, 10);
                    (parsedObj[key] as any) = intVal === 1 || value === "true" ? 1 : 0;
                    break;
                }
                case "array":
                    (parsedObj[key] as any) = value.split(",");
                    break;
                default:
                    (parsedObj[key] as any) = value;
            }
        }

        // 2. Safely cast the fully built object to SettingKeyValue on return
        return parsedObj as SettingKeyValue;
    }

    /**
     * Evicts the local memory cache (triggered by pub/sub when settings change).
     */
    clearLocalCache(): void {
        this.localCache = null;
    }

    async createSetting(data: CreateSettingDTO): Promise<Setting> {
        const setting: Setting = await this.settingRepository.create(data);

        // update the local cache and publish newly created setting
        await this.boot();

        return setting;
    }

    async updateSetting(
        id: number,
        data: UpdateSettingDTO,
    ): Promise<Setting> {
        const setting: Setting | null = await this.settingRepository.update(id, data);

        if (!setting) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        // Update the local cache and publish the updated setting.
        await this.boot();

        return setting;
    }

    async browseSettings(
        filters: BrowseSettingQuery,
    ): Promise<Setting[]> {
        const MAX_PER_PAGE = 100;

        const page = Math.max(1, filters.page || 1);

        const perPage = Math.min(
            MAX_PER_PAGE,
            Math.max(1, filters.perPage || 20),
        );

        const normalizedFilters: BrowseSettingQuery = {
            ...filters,
            page,
            perPage,
            search: filters.search?.trim() || undefined,
        };

        return this.settingRepository.browse(normalizedFilters);
    }

    async findById(id: number): Promise<Setting> {
        const setting = await this.settingRepository.findById(id);
        if (!setting) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }
        return setting;
    }

    async hardDelete(id: number): Promise<void> {
        if (!await this.settingRepository.hardDelete(id)) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        // Update the local cache and publish the updated setting.
        await this.boot();
    }
}