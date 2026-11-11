// src/modules/system/health/health.routes.ts
import {Router} from "express";
import catchAsync from "../../../common/utils/catch-async";
import {renderMetrics} from "../../../common/metrics/metrics";
import {HealthService} from "./health.service";

const healthService = new HealthService();

export default () => {
    const router = Router();

    /**
     * Liveness probe.
     *
     * Unauthenticated and dependency-free by design: a liveness probe
     * must not fail because a downstream service is unavailable.
     */
    router.get("/live", (_req, res) => {
        res.status(200).json(healthService.live());
    });

    /**
     * Readiness probe.
     *
     * Returns 503 when a required dependency is unavailable. The body
     * contains only up/down state, never versions, hosts or stacks.
     */
    router.get(
        "/ready",
        catchAsync(async (_req, res) => {
            const report = await healthService.ready();

            res.status(report.status === "ready" ? 200 : 503).json(report);
        }),
    );

    return router;
};
