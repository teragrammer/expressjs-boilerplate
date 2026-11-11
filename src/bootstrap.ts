// src/bootstrap.ts
import {__ENV} from "./config/environment";
import {logger} from "./config/logger";
import {
    cleanupJob,
    redisSubscriber,
    routeGuardService,
    settingService,
    systemEventHandler,
    outboxWorker,
} from "./config/container";

import {SettingService} from "./modules/system/settings/setting.service";
import {RouteGuardService} from "./modules/system/route-guards/route-guard.service";

export async function bootstrap(): Promise<void> {
    logger.info("Initializing system modules...");

    // Warm system caches in parallel.
    await Promise.all([
        settingService.boot(),
        routeGuardService.boot(),
    ]);

    logger.info(
        "System settings and route guards successfully cached.",
    );

    await initializeRedisSubscriptions();

    startBackgroundJobs();
}

/**
 * Starts the background workers.
 *
 * The outbox worker dispatches queued email and cleanup jobs; the
 * cleanup job removes expired rows. Both are safe to run in every
 * worker: the outbox claims rows with `FOR UPDATE SKIP LOCKED`, so two
 * workers never process the same event.
 */
function startBackgroundJobs(): void {
    if (!__ENV.OUTBOX_ENABLED) {
        logger.info("Outbox worker disabled by configuration.");
        return;
    }

    outboxWorker.start();
    cleanupJob.start();
}

async function initializeRedisSubscriptions(): Promise<void> {
    if (!redisSubscriber.isConnected()) {
        logger.warn(
            "Redis is offline or disconnected. Running in fallback database-only mode.",
        );

        return;
    }

    await redisSubscriber.subscribe(
        SettingService.CACHE_KEY,
        async (channel: string) => {
            await systemEventHandler.handleCacheUpdate(channel);
        },
    );

    await redisSubscriber.subscribe(
        RouteGuardService.CACHE_KEY,
        async (channel: string) => {
            await systemEventHandler.handleCacheUpdate(channel);
        },
    );

    logger.info(
        "System module subscriptions and listeners initialized.",
    );
}
