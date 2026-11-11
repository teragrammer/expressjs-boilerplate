// src/routes/metrics.ts
import {Router} from "express";
import catchAsync from "../common/utils/catch-async";
import {renderMetrics} from "../common/metrics/metrics";
import {__ENV} from "../config/environment";

/**
 * Prometheus scrape endpoint.
 *
 * Mounted at the application root (outside `/api/v1`) because scrapers
 * conventionally target `/metrics`. The endpoint is unauthenticated by
 * design and must be restricted at the network layer.
 */
export default () => {
    const router = Router();

    router.get(
        __ENV.METRICS_PATH,
        catchAsync(async (_req, res) => {
            if (!__ENV.METRICS_ENABLED) {
                res.status(404).json({code: "DATA_NOT_FOUND"});
                return;
            }

            res.setHeader(
                "Content-Type",
                "text/plain; version=0.0.4; charset=utf-8",
            );
            res.status(200).send(await renderMetrics());
        }),
    );

    return router;
};
