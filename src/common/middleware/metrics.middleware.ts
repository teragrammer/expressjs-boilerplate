// src/common/middleware/metrics.middleware.ts
import {NextFunction, Request, Response} from "express";
import {
    httpRequestDuration,
    httpRequestsTotal,
} from "../metrics/metrics";

/**
 * Records HTTP request counters and latency histograms.
 *
 * Route templates are used as the label value so a high-cardinality
 * URL (with ids, tokens or search terms) never becomes a metric label.
 */
export function metricsMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const route = (req as Request & {route?: {path?: string}}).route;
        const labels = {
            method: req.method,
            route: route?.path ?? "unmatched",
            status: String(res.statusCode),
        };

        const durationSeconds =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, durationSeconds);
    });

    next();
}
