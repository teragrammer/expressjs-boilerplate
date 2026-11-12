// src/app.ts
import express, {Request, Response,} from "express";

import v1 from "./routes/v1";
import metricsRoutes from "./routes/metrics";
import docsRoutes from "./routes/docs";
import healthRoutes from "./modules/system/health/health.routes";
import errors from "./common/utils/messages";

import requestHandler from "./common/middleware/request.middleware";
import responseHandler from "./common/middleware/response.middleware";
import {errorHandler} from "./common/middleware/error.middleware";
import {
    requestContextMiddleware,
    requestLoggingMiddleware,
} from "./common/middleware/request-context.middleware";
import {metricsMiddleware} from "./common/middleware/metrics.middleware";

import {configureMiddleware} from "./config/http";
import {bootstrap} from "./bootstrap";

const app = express();

configureMiddleware(app);

/*
 * Request context first: every later middleware (logging, metrics,
 * audit) needs the correlation id.
 */
app.use(requestContextMiddleware);
app.use(requestLoggingMiddleware);
app.use(metricsMiddleware);

app.use(requestHandler);
app.use(responseHandler);

/*
 * Operational endpoints.
 *
 * Health and metrics live outside `/api/v1` because probes and scrapers
 * target well-known paths.
 */
app.use("/health", healthRoutes());
app.use(metricsRoutes());

app.use("/api/v1", v1());

/*
 * OpenAPI contract and Swagger UI. Mounted at the application root so
 * the documentation is reachable without a version prefix.
 */
app.use(docsRoutes());

app.use((_req: Request, res: Response) => {
    res.status(404).json({
        code: errors.DATA_NOT_FOUND.code,
        message: errors.DATA_NOT_FOUND.message,
    });
});

app.use(errorHandler);

export {bootstrap};

export default app;
