// src/index.ts
import os from "node:os";
import cluster from "node:cluster";

import app, {bootstrap} from "./app";
import {logger} from "./config/logger";
import {__ENV} from "./config/environment";
import {
    checkDbConnection,
    closeDatabase,
    validateConnectionBudget,
} from "./config/database";
import {disconnectRedis} from "./config/redis";

const DEFAULT_CLUSTER_WORKERS = Math.max(1, os.cpus().length);

const parsedWorkers = Number(__ENV.CLUSTER_WORKERS);
const clusterWorkers = Math.max(
    1,
    Number.isFinite(parsedWorkers) && parsedWorkers > 0
        ? parsedWorkers
        : DEFAULT_CLUSTER_WORKERS,
);

const isClusterEnabled =
    __ENV.CLUSTER === "true" && DEFAULT_CLUSTER_WORKERS > 1;

/**
 * Fails fast when the configured pool would exhaust the database's
 * connection budget across all workers of this process.
 */
function assertConnectionBudget(): void {
    const workers = isClusterEnabled ? clusterWorkers : 1;

    const budget = validateConnectionBudget({
        poolMax: Number(__ENV.DB_POOL_MAX),
        workers,
        maxConnections: Number(__ENV.DB_MAX_CONNECTIONS_TOTAL),
    });

    if (!budget.valid) {
        logger.warn(
            `Connection budget exceeded: ${workers} worker(s) x ` +
            `DB_POOL_MAX=${__ENV.DB_POOL_MAX} projects to ` +
            `${budget.projected} connections against a limit of ` +
            `${__ENV.DB_MAX_CONNECTIONS_TOTAL}. ` +
            `Recommended DB_POOL_MAX is ${budget.recommended}.`,
        );
        return;
    }

    logger.info(
        `Connection budget OK: ${budget.projected} of ` +
        `${__ENV.DB_MAX_CONNECTIONS_TOTAL} connections reserved.`,
    );
}

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

        assertConnectionBudget();

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

void main();
