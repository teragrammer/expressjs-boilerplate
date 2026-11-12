// src/index.ts
import cluster from "node:cluster";

import app, {bootstrap} from "./app";
import {logger} from "./config/logger";
import {__ENV} from "./config/environment";
import {
    assertConnectionBudget,
    checkDbConnection,
    closeDatabase,
} from "./config/database";
import {
    isClusterEnabled as resolveIsClusterEnabled,
    resolveClusterWorkers,
} from "./config/cluster";
import {disconnectRedis} from "./config/redis";

const clusterWorkers = resolveClusterWorkers(__ENV.CLUSTER_WORKERS);

const isClusterEnabled = resolveIsClusterEnabled(__ENV.CLUSTER);

/**
 * Application entry point.
 *
 * In cluster mode:
 * - Primary process manages workers.
 * - Workers bootstrap the application and listen for HTTP traffic.
 *
 * In standalone mode:
 * - The current process bootstraps and starts the HTTP server.
 */
async function main(): Promise<void> {
    const workers = isClusterEnabled ? clusterWorkers : 1;

    const budget = assertConnectionBudget({
        poolMax: Number(__ENV.DB_POOL_MAX),
        workers,
        maxConnections: Number(__ENV.DB_MAX_CONNECTIONS_TOTAL),
    });

    logger.info(
        `Environment: ${__ENV.NODE_ENV}; cluster: ` +
        `${isClusterEnabled ? `enabled (${clusterWorkers} workers)` : "disabled"}; ` +
        `connection budget: ${budget.projected} of ` +
        `${__ENV.DB_MAX_CONNECTIONS_TOTAL} reserved.`,
    );

    if (isClusterEnabled && cluster.isPrimary) {
        startPrimary();
        return;
    }

    await startWorker();
}

/**
 * Starts the cluster primary process.
 */
function startPrimary(): void {
    logger.info(
        `[Primary ${process.pid}] Starting ${clusterWorkers} workers...`,
    );

    for (let index = 0; index < clusterWorkers; index += 1) {
        spawnWorker();
    }

    cluster.on("exit", handleWorkerExit);

    registerPrimaryShutdown();
}

/**
 * Registers graceful shutdown for the cluster primary.
 *
 * The primary forwards the signal to every worker, waits for them to
 * exit, and only then terminates. Without this an orchestrator restart
 * would kill workers abruptly.
 */
function registerPrimaryShutdown(): void {
    let isShuttingDown = false;

    const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
        if (isShuttingDown) {
            return;
        }

        isShuttingDown = true;

        logger.info(
            `[Primary ${process.pid}] Received ${signal}. Forwarding to workers...`,
        );

        const workers = Object.values(cluster.workers ?? {});

        for (const worker of workers) {
            if (!worker?.process) {
                continue;
            }

            try {
                worker.process.kill(signal);
            } catch {
                // The worker may already be gone; nothing to do.
            }
        }

        const forceTimer = setTimeout(() => {
            logger.error(
                `[Primary ${process.pid}] Workers did not exit in time. Forcing termination.`,
            );
            process.exit(1);
        }, 15_000);

        forceTimer.unref();

        let remaining = workers.length;

        if (remaining === 0) {
            clearTimeout(forceTimer);
            process.exit(0);
            return;
        }

        const onWorkerExit = (): void => {
            remaining -= 1;

            if (remaining > 0) {
                return;
            }

            clearTimeout(forceTimer);
            logger.info(
                `[Primary ${process.pid}] All workers exited. Shutting down.`,
            );
            process.exit(0);
        };

        cluster.on("exit", onWorkerExit);
    };

    process.once("SIGTERM", () => {
        void shutdown("SIGTERM");
    });

    process.once("SIGINT", () => {
        void shutdown("SIGINT");
    });
}

/**
 * Creates a new cluster worker.
 */
function spawnWorker(): void {
    const worker = cluster.fork();

    logger.info(
        `[Primary ${process.pid}] Worker ${worker.id} started ` +
        `(PID: ${worker.process.pid})`,
    );
}

/**
 * Handles unexpected worker termination.
 *
 * The primary process replaces the worker so the configured
 * worker capacity is maintained.
 */
function handleWorkerExit(
    worker: cluster.Worker,
    code: number | null,
    signal: NodeJS.Signals | null,
): void {
    logger.warn(
        `[Primary ${process.pid}] Worker ${worker.process.pid} exited ` +
        `(code: ${code}, signal: ${signal}). Replacing worker...`,
    );

    spawnWorker();
}

/**
 * Bootstraps dependencies and starts the HTTP server.
 */
async function startWorker(): Promise<void> {
    try {
        await bootstrap();

        const dbConnected = await checkDbConnection();

        if (!dbConnected) {
            logger.error(
                `[Worker ${process.pid}] Database connection check failed. ` +
                "Worker will not start.",
            );

            process.exit(1);
        }

        const server = app.listen(__ENV.PORT, () => {
            logger.info(
                `[Worker ${process.pid}] Server online on port ${__ENV.PORT}`,
            );
        });

        /*
         * Server-level timeouts protect against slowloris and keep the
         * shutdown drain bounded.
         */
        server.headersTimeout = 65_000;
        server.requestTimeout = 60_000;
        server.keepAliveTimeout = 61_000;

        registerGracefulShutdown(server);
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Unknown initialization error";

        logger.error(
            `[Worker ${process.pid}] Critical initialization failure: ${message}`,
        );

        process.exit(1);
    }
}

/**
 * Registers graceful shutdown handlers for the worker.
 */
function registerGracefulShutdown(
    server: ReturnType<typeof app.listen>,
): void {
    let isShuttingDown = false;

    const gracefulShutdown = async (
        signal: NodeJS.Signals,
    ): Promise<void> => {
        if (isShuttingDown) {
            return;
        }

        isShuttingDown = true;

        logger.info(
            `[Worker ${process.pid}] Received ${signal}. ` +
            "Starting graceful shutdown...",
        );

        const forceShutdownTimer = setTimeout(() => {
            logger.error(
                `[Worker ${process.pid}] Shutdown timed out. ` +
                "Forcing process termination.",
            );

            process.exit(1);
        }, 10_000);

        forceShutdownTimer.unref();

        server.close(async (serverError?: Error) => {
            if (serverError) {
                logger.error(
                    `[Worker ${process.pid}] Failed to close HTTP server: ` +
                    serverError.message,
                );

                clearTimeout(forceShutdownTimer);
                process.exit(1);
            }

            try {
                logger.info(
                    `[Worker ${process.pid}] HTTP server closed. ` +
                    "Cleaning up dependencies...",
                );

                await closeDependencies();

                clearTimeout(forceShutdownTimer);

                logger.info(
                    `[Worker ${process.pid}] Graceful shutdown completed.`,
                );

                process.exit(0);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : "Unknown cleanup error";

                logger.error(
                    `[Worker ${process.pid}] Error during shutdown: ${message}`,
                );

                clearTimeout(forceShutdownTimer);

                process.exit(1);
            }
        });
    };

    process.once("SIGINT", () => {
        void gracefulShutdown("SIGINT");
    });

    process.once("SIGTERM", () => {
        void gracefulShutdown("SIGTERM");
    });
}

/**
 * Closes application infrastructure connections.
 */
async function closeDependencies(): Promise<void> {
    await closeDatabase();

    logger.info(
        `[Worker ${process.pid}] Database pool safely drained.`,
    );

    await disconnectRedis();

    logger.info(
        `[Worker ${process.pid}] Redis connection closed.`,
    );
}

void main().catch((error: unknown) => {
    const message =
        error instanceof Error
            ? error.message
            : "Unknown initialization error";

    logger.error(
        `[Worker ${process.pid}] Critical startup failure: ${message}`,
    );

    process.exit(1);
});
