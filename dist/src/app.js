"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.bootstrap = void 0;
// src/app.ts
const express_1 = __importDefault(require("express"));
const v1_1 = __importDefault(require("./routes/v1"));
const metrics_1 = __importDefault(require("./routes/metrics"));
const health_routes_1 = __importDefault(require("./modules/system/health/health.routes"));
const messages_1 = __importDefault(require("./common/utils/messages"));
const request_middleware_1 = __importDefault(require("./common/middleware/request.middleware"));
const response_middleware_1 = __importDefault(require("./common/middleware/response.middleware"));
const error_middleware_1 = require("./common/middleware/error.middleware");
const request_context_middleware_1 = require("./common/middleware/request-context.middleware");
const metrics_middleware_1 = require("./common/middleware/metrics.middleware");
const http_1 = require("./config/http");
const bootstrap_1 = require("./bootstrap");
Object.defineProperty(exports, "bootstrap", { enumerable: true, get: function () { return bootstrap_1.bootstrap; } });
const app = (0, express_1.default)();
(0, http_1.configureMiddleware)(app);
/*
 * Request context first: every later middleware (logging, metrics,
 * audit) needs the correlation id.
 */
app.use(request_context_middleware_1.requestContextMiddleware);
app.use(request_context_middleware_1.requestLoggingMiddleware);
app.use(metrics_middleware_1.metricsMiddleware);
app.use(request_middleware_1.default);
app.use(response_middleware_1.default);
/*
 * Operational endpoints.
 *
 * Health and metrics live outside `/api/v1` because probes and scrapers
 * target well-known paths.
 */
app.use("/health", (0, health_routes_1.default)());
app.use((0, metrics_1.default)());
app.use("/api/v1", (0, v1_1.default)());
app.use((_req, res) => {
    res.status(404).json({
        code: messages_1.default.DATA_NOT_FOUND.code,
        message: messages_1.default.DATA_NOT_FOUND.message,
    });
});
app.use(error_middleware_1.errorHandler);
exports.default = app;
