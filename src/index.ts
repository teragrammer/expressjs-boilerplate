// src/server.ts
import os from "node:os";
import cluster from "node:cluster";

import app, {bootstrap} from "./app";
import {logger} from "./config/logger";
import {__ENV} from "./config/environment";
import {checkDbConnection, closeDatabase} from "./config/database";
import {disconnectRedis} from "./config/redis";

const DEFAULT_CLUSTER_WORKERS = Math.max(1, os.cpus().length);

const clusterWorkers = Math.max(
    1,
    Number(__ENV.CLUSTER_WORKERS ?? DEFAULT_CLUSTER_WORKERS),
);

const isClusterEnabled =
    Boolean(__ENV.CLUSTER) && DEFAULT_CLUSTER_WORKERS > 1;

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

void main();
