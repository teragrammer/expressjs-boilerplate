"use strict";
// src/modules/system/events/system.event.ts
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemEventHandler = void 0;
const logger_1 = require("../../../config/logger");
const setting_service_1 = require("./setting.service");
const route_guard_service_1 = require("../route-guards/route-guard.service");
class SystemEventHandler {
    constructor(redisCache, settingService, routeGuardService) {
        this.redisCache = redisCache;
        this.settingService = settingService;
        this.routeGuardService = routeGuardService;
    }
    /**
     * Centralized event processor for cache update events.
     * Fetches, decrypts, and updates local memory caches based on the incoming channel.
     * * NOTE: This updates the L1 memory layer directly to prevent an infinite write-back loop.
     */
    handleCacheUpdate(channel) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                logger_1.logger.info(`System event received on channel: ${channel}. Synchronizing local caches...`);
                if (channel === setting_service_1.SettingService.CACHE_KEY) {
                    // 1. Fetch, decrypt, and parse the updated configuration payload securely from Redis
                    const freshSettings = yield this.redisCache.get(setting_service_1.SettingService.CACHE_KEY);
                    if (freshSettings) {
                        // Update the L1 local memory reference directly.
                        // DO NOT call .boot() here, as .boot() writes back to Redis and causes a loop.
                        this.settingService.updateLocalMemory(freshSettings);
                        logger_1.logger.info("Local Setting L1 cache updated.");
                    }
                }
                if (channel === route_guard_service_1.RouteGuardService.CACHE_KEY) {
                    // 2. Fetch, decrypt, and parse the updated route mappings securely from Redis
                    const freshGuards = yield this.redisCache.get(route_guard_service_1.RouteGuardService.CACHE_KEY);
                    if (freshGuards) {
                        // Update the L1 local memory reference directly.
                        // DO NOT call .boot() here, as .boot() writes back to Redis and causes a loop.
                        this.routeGuardService.updateLocalMemory(freshGuards);
                        logger_1.logger.info("Local Route Guard L1 cache updated.");
                    }
                }
            }
            catch (err) {
                logger_1.logger.error(`Failed handling event for channel ${channel}: ${err.message}`);
            }
        });
    }
}
exports.SystemEventHandler = SystemEventHandler;
