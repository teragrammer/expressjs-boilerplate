"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const node_os_1 = __importDefault(require("node:os"));
const node_cluster_1 = __importDefault(require("node:cluster"));
const app_1 = __importStar(require("./app"));
const logger_1 = require("./config/logger");
const environment_1 = require("./config/environment");
const database_1 = require("./config/database");
const redis_1 = require("./config/redis");
const DEFAULT_CLUSTER_WORKERS = Math.max(1, node_os_1.default.cpus().length);
const clusterWorkers = Math.max(1, Number((_a = environment_1.__ENV.CLUSTER_WORKERS) !== null && _a !== void 0 ? _a : DEFAULT_CLUSTER_WORKERS));
const isClusterEnabled = Boolean(environment_1.__ENV.CLUSTER) && DEFAULT_CLUSTER_WORKERS > 1;
/**
 * Fails fast when the configured pool would exhaust the database's
 * connection budget across all workers of this process.
 */
function assertConnectionBudget() {
    const workers = isClusterEnabled ? clusterWorkers : 1;
    const budget = (0, database_1.validateConnectionBudget)({
        poolMax: Number(environment_1.__ENV.DB_POOL_MAX),
        workers,
        maxConnections: Number(environment_1.__ENV.DB_MAX_CONNECTIONS_TOTAL),
    });
    if (!budget.valid) {
        logger_1.logger.warn(`Connection budget exceeded: ${workers} worker(s) x ` +
            `DB_POOL_MAX=${environment_1.__ENV.DB_POOL_MAX} projects to ` +
            `${budget.projected} connections against a limit of ` +
            `${environment_1.__ENV.DB_MAX_CONNECTIONS_TOTAL}. ` +
            `Recommended DB_POOL_MAX is ${budget.recommended}.`);
        return;
    }
    logger_1.logger.info(`Connection budget OK: ${budget.projected} of ` +
        `${environment_1.__ENV.DB_MAX_CONNECTIONS_TOTAL} connections reserved.`);
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
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (isClusterEnabled && node_cluster_1.default.isPrimary) {
            startPrimary();
            return;
        }
        yield startWorker();
    });
}
/**
 * Starts the cluster primary process.
 */
function startPrimary() {
    logger_1.logger.info(`[Primary ${process.pid}] Starting ${clusterWorkers} workers...`);
    for (let index = 0; index < clusterWorkers; index += 1) {
        spawnWorker();
    }
    node_cluster_1.default.on("exit", handleWorkerExit);
    registerPrimaryShutdown();
}
/**
 * Registers graceful shutdown for the cluster primary.
 *
 * The primary forwards the signal to every worker, waits for them to
 * exit, and only then terminates. Without this an orchestrator restart
 * would kill workers abruptly.
 */
function registerPrimaryShutdown() {
    let isShuttingDown = false;
    const shutdown = (signal) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        if (isShuttingDown) {
            return;
        }
        isShuttingDown = true;
        logger_1.logger.info(`[Primary ${process.pid}] Received ${signal}. Forwarding to workers...`);
        const workers = Object.values((_a = node_cluster_1.default.workers) !== null && _a !== void 0 ? _a : {});
        for (const worker of workers) {
            if (!(worker === null || worker === void 0 ? void 0 : worker.process)) {
                continue;
            }
            try {
                worker.process.kill(signal);
            }
            catch (_b) {
                // The worker may already be gone; nothing to do.
            }
        }
        const forceTimer = setTimeout(() => {
            logger_1.logger.error(`[Primary ${process.pid}] Workers did not exit in time. Forcing termination.`);
            process.exit(1);
        }, 15000);
        forceTimer.unref();
        let remaining = workers.length;
        if (remaining === 0) {
            clearTimeout(forceTimer);
            process.exit(0);
            return;
        }
        const onWorkerExit = () => {
            remaining -= 1;
            if (remaining > 0) {
                return;
            }
            clearTimeout(forceTimer);
            logger_1.logger.info(`[Primary ${process.pid}] All workers exited. Shutting down.`);
            process.exit(0);
        };
        node_cluster_1.default.on("exit", onWorkerExit);
    });
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
function spawnWorker() {
    const worker = node_cluster_1.default.fork();
    logger_1.logger.info(`[Primary ${process.pid}] Worker ${worker.id} started ` +
        `(PID: ${worker.process.pid})`);
}
/**
 * Handles unexpected worker termination.
 *
 * The primary process replaces the worker so the configured
 * worker capacity is maintained.
 */
function handleWorkerExit(worker, code, signal) {
    logger_1.logger.warn(`[Primary ${process.pid}] Worker ${worker.process.pid} exited ` +
        `(code: ${code}, signal: ${signal}). Replacing worker...`);
    spawnWorker();
}
/**
 * Bootstraps dependencies and starts the HTTP server.
 */
function startWorker() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, app_1.bootstrap)();
            const dbConnected = yield (0, database_1.checkDbConnection)();
            if (!dbConnected) {
                logger_1.logger.error(`[Worker ${process.pid}] Database connection check failed. ` +
                    "Worker will not start.");
                process.exit(1);
            }
            assertConnectionBudget();
            const server = app_1.default.listen(environment_1.__ENV.PORT, () => {
                logger_1.logger.info(`[Worker ${process.pid}] Server online on port ${environment_1.__ENV.PORT}`);
            });
            /*
             * Server-level timeouts protect against slowloris and keep the
             * shutdown drain bounded.
             */
            server.headersTimeout = 65000;
            server.requestTimeout = 60000;
            server.keepAliveTimeout = 61000;
            registerGracefulShutdown(server);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : "Unknown initialization error";
            logger_1.logger.error(`[Worker ${process.pid}] Critical initialization failure: ${message}`);
            process.exit(1);
        }
    });
}
/**
 * Registers graceful shutdown handlers for the worker.
 */
function registerGracefulShutdown(server) {
    let isShuttingDown = false;
    const gracefulShutdown = (signal) => __awaiter(this, void 0, void 0, function* () {
        if (isShuttingDown) {
            return;
        }
        isShuttingDown = true;
        logger_1.logger.info(`[Worker ${process.pid}] Received ${signal}. ` +
            "Starting graceful shutdown...");
        const forceShutdownTimer = setTimeout(() => {
            logger_1.logger.error(`[Worker ${process.pid}] Shutdown timed out. ` +
                "Forcing process termination.");
            process.exit(1);
        }, 10000);
        forceShutdownTimer.unref();
        server.close((serverError) => __awaiter(this, void 0, void 0, function* () {
            if (serverError) {
                logger_1.logger.error(`[Worker ${process.pid}] Failed to close HTTP server: ` +
                    serverError.message);
                clearTimeout(forceShutdownTimer);
                process.exit(1);
            }
            try {
                logger_1.logger.info(`[Worker ${process.pid}] HTTP server closed. ` +
                    "Cleaning up dependencies...");
                yield closeDependencies();
                clearTimeout(forceShutdownTimer);
                logger_1.logger.info(`[Worker ${process.pid}] Graceful shutdown completed.`);
                process.exit(0);
            }
            catch (error) {
                const message = error instanceof Error
                    ? error.message
                    : "Unknown cleanup error";
                logger_1.logger.error(`[Worker ${process.pid}] Error during shutdown: ${message}`);
                clearTimeout(forceShutdownTimer);
                process.exit(1);
            }
        }));
    });
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
function closeDependencies() {
    return __awaiter(this, void 0, void 0, function* () {
        yield (0, database_1.closeDatabase)();
        logger_1.logger.info(`[Worker ${process.pid}] Database pool safely drained.`);
        yield (0, redis_1.disconnectRedis)();
        logger_1.logger.info(`[Worker ${process.pid}] Redis connection closed.`);
    });
}
void main();
