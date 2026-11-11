// src/modules/system/health/health.service.ts
import {sql} from "kysely";
import {db, type DatabaseExecutor} from "../../../config/database";
import {DBRedis} from "../../../config/redis";
import {logger} from "../../../config/logger";

export type DependencyStatus = "up" | "down" | "disabled";

export interface ReadinessReport {
    status: "ready" | "not_ready";
    dependencies: {
        database: DependencyStatus;
        redis: DependencyStatus;
    };
}

/**
 * Readiness cache.
 *
 * Probes run on a timer so an orchestrator polling every second does
 * not translate into a database query per second.
 */
const READINESS_TTL_MS = 5_000;

let cachedReport: {report: ReadinessReport; expiresAt: number} | null = null;

/**
 * Checks PostgreSQL with a lightweight query.
 */
async function checkDatabase(
    executor: DatabaseExecutor = db,
): Promise<DependencyStatus> {
    try {
        await sql`SELECT 1`.execute(executor);
        return "up";
    } catch (error) {
        logger.error(
            `Readiness database check failed: ${(error as Error).message}`,
        );
        return "down";
    }
}

/**
 * Checks Redis when it is configured.
 */
function checkRedis(): DependencyStatus {
    if (!DBRedis.publisher) {
        return "disabled";
    }

    const status = DBRedis.publisher.status;

    return status === "ready" || status === "connect" ? "up" : "down";
}

export class HealthService {
    /**
     * Liveness: the process is up and the event loop is responsive.
     *
     * No dependency checks are performed; a liveness probe must not
     * fail because a downstream service is unavailable.
     */
    live(): {status: "alive"; uptimeSeconds: number} {
        return {
            status: "alive",
            uptimeSeconds: Math.round(process.uptime()),
        };
    }

    /**
     * Readiness: the process can serve traffic.
     *
     * The result is cached for a few seconds to keep probe traffic away
     * from the database.
     */
    async ready(): Promise<ReadinessReport> {
        if (cachedReport && cachedReport.expiresAt > Date.now()) {
            return cachedReport.report;
        }

        const database = await checkDatabase();
        const redis = checkRedis();

        const report: ReadinessReport = {
            status:
                database === "up" && redis !== "down"
                    ? "ready"
                    : "not_ready",
            dependencies: {database, redis},
        };

        cachedReport = {
            report,
            expiresAt: Date.now() + READINESS_TTL_MS,
        };

        return report;
    }
}
