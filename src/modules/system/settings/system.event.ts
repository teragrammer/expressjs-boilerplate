// src/modules/system/settings/system.event.ts

import {logger} from "../../../config/logger";
import {RedisCache} from "../../../shared/redis/redis-cache";
import {SettingService} from "./setting.service";
import {RouteGuardService} from "../route-guards/route-guard.service";

export class SystemEventHandler {
    constructor(
        private readonly redisCache: RedisCache,
        private readonly settingService: SettingService,
        private readonly routeGuardService: RouteGuardService
    ) {
    }

    /**
     * Centralized event processor for cache update events.
     * Fetches, decrypts, and updates local memory caches based on the incoming channel.
     * * NOTE: This updates the L1 memory layer directly to prevent an infinite write-back loop.
     */
    async handleCacheUpdate(channel: string): Promise<void> {
        try {
            logger.info(`System event received on channel: ${channel}. Synchronizing local caches...`);

            if (channel === SettingService.CACHE_KEY) {
                // 1. Fetch, decrypt, and parse the updated configuration payload securely from Redis
                const freshSettings = await this.redisCache.get<any>(SettingService.CACHE_KEY);
                if (freshSettings) {
                    // Update the L1 local memory reference directly.
                    // DO NOT call .boot() here, as .boot() writes back to Redis and causes a loop.
                    this.settingService.updateLocalMemory(freshSettings);
                    logger.info("Local Setting L1 cache updated.");
                }
            }

            if (channel === RouteGuardService.CACHE_KEY) {
                // 2. Fetch, decrypt, and parse the updated route mappings securely from Redis
                const freshGuards = await this.redisCache.get<any>(RouteGuardService.CACHE_KEY);
                if (freshGuards) {
                    // Update the L1 local memory reference directly.
                    // DO NOT call .boot() here, as .boot() writes back to Redis and causes a loop.
                    this.routeGuardService.updateLocalMemory(freshGuards);
                    logger.info("Local Route Guard L1 cache updated.");
                }
            }

        } catch (err: any) {
            logger.error(`Failed handling event for channel ${channel}: ${err.message}`);
        }
    }
}