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


/**
 * Checks PostgreSQL with a lightweight query.
 */
export async function probeDatabase(
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
export function probeRedis(): DependencyStatus {
    if (!DBRedis.publisher) {
        return "disabled";
    }

    const status = DBRedis.publisher.status;

    return status === "ready" || status === "connect" ? "up" : "down";
}

export class HealthService {
    /**
     * The cached readiness result.
     *
     * The cache belongs to the instance: two services with different
     * probes must not share a result.
     */
    private cachedReport: {
        report: ReadinessReport;
        expiresAt: number;
    } | null = null;

    constructor(
        private readonly databaseProbe: () => Promise<DependencyStatus> = () =>
            probeDatabase(),
        private readonly redisProbe: () => DependencyStatus = probeRedis,
    ) {
    }

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
        if (
            this.cachedReport &&
            this.cachedReport.expiresAt > Date.now()
        ) {
            return this.cachedReport.report;
        }

        const database = await this.databaseProbe();
        const redis = this.redisProbe();

        const report: ReadinessReport = {
            status:
                database === "up" && redis !== "down"
                    ? "ready"
                    : "not_ready",
            dependencies: {database, redis},
        };

        this.cachedReport = {
            report,
            expiresAt: Date.now() + READINESS_TTL_MS,
        };

        return report;
    }
}
