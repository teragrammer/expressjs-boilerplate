"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = metricsMiddleware;
const metrics_1 = require("../metrics/metrics");
/**
 * Records HTTP request counters and latency histograms.
 *
 * Route templates are used as the label value so a high-cardinality
 * URL (with ids, tokens or search terms) never becomes a metric label.
 */
function metricsMiddleware(req, res, next) {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
        var _a;
        const route = req.route;
        const labels = {
            method: req.method,
            route: (_a = route === null || route === void 0 ? void 0 : route.path) !== null && _a !== void 0 ? _a : "unmatched",
            status: String(res.statusCode),
        };
        const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1000000000;
        metrics_1.httpRequestsTotal.inc(labels);
        metrics_1.httpRequestDuration.observe(labels, durationSeconds);
    });
    next();
}
