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
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrap = bootstrap;
// src/bootstrap.ts
const environment_1 = require("./config/environment");
const logger_1 = require("./config/logger");
const container_1 = require("./config/container");
const setting_service_1 = require("./modules/system/settings/setting.service");
const route_guard_service_1 = require("./modules/system/route-guards/route-guard.service");
function bootstrap() {
    return __awaiter(this, void 0, void 0, function* () {
        logger_1.logger.info("Initializing system modules...");
        // Warm system caches in parallel.
        yield Promise.all([
            container_1.settingService.boot(),
            container_1.routeGuardService.boot(),
        ]);
        logger_1.logger.info("System settings and route guards successfully cached.");
        yield initializeRedisSubscriptions();
        startBackgroundJobs();
    });
}
/**
 * Starts the background workers.
 *
 * The outbox worker dispatches queued email and cleanup jobs; the
 * cleanup job removes expired rows. Both are safe to run in every
 * worker: the outbox claims rows with `FOR UPDATE SKIP LOCKED`, so two
 * workers never process the same event.
 */
function startBackgroundJobs() {
    if (!environment_1.__ENV.OUTBOX_ENABLED) {
        logger_1.logger.info("Outbox worker disabled by configuration.");
        return;
    }
    container_1.outboxWorker.start();
    container_1.cleanupJob.start();
}
function initializeRedisSubscriptions() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!container_1.redisSubscriber.isConnected()) {
            logger_1.logger.warn("Redis is offline or disconnected. Running in fallback database-only mode.");
            return;
        }
        yield container_1.redisSubscriber.subscribe(setting_service_1.SettingService.CACHE_KEY, (channel) => __awaiter(this, void 0, void 0, function* () {
            yield container_1.systemEventHandler.handleCacheUpdate(channel);
        }));
        yield container_1.redisSubscriber.subscribe(route_guard_service_1.RouteGuardService.CACHE_KEY, (channel) => __awaiter(this, void 0, void 0, function* () {
            yield container_1.systemEventHandler.handleCacheUpdate(channel);
        }));
        logger_1.logger.info("System module subscriptions and listeners initialized.");
    });
}
