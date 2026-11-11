// src/common/middleware/request-context.middleware.ts
import {randomUUID} from "node:crypto";
import {NextFunction, Request, Response} from "express";
import {
    runWithRequestContext,
    updateRequestContext,
    type RequestContext,
} from "../context/request-context";
import {logger} from "../../config/logger";
const REQUEST_ID_HEADER = "x-request-id";

/** Maximum accepted length of a client-supplied request id. */
const MAX_REQUEST_ID_LENGTH = 128;

const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]+$/;

/**
 * Validates a client-supplied request id.
 *
 * Arbitrary or oversized values are rejected so a caller cannot inject
 * unbounded content into the log stream.
 */
function sanitizeRequestId(value: unknown): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    const trimmed = value.trim();

    if (
        trimmed.length === 0 ||
        trimmed.length > MAX_REQUEST_ID_LENGTH ||
        !SAFE_REQUEST_ID.test(trimmed)
    ) {
        return undefined;
    }

    return trimmed;
}

/**
 * Resolves the route template of a request.
 *
 * Express only knows the matched route after routing completes, so
 * this returns `undefined` before the handler runs.
 */
export function getRouteTemplate(req: Request): string | undefined {
    const route = (req as Request & {route?: {path?: string}}).route;

    return route?.path;
}

/**
 * Establishes the per-request context.
 *
 * The request id is generated when the client does not supply a valid
 * one, and is always returned in the `X-Request-ID` response header.
 */
export function requestContextMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const requestId =
        sanitizeRequestId(req.headers[REQUEST_ID_HEADER]) ?? randomUUID();

    res.setHeader("X-Request-ID", requestId);

    const context: RequestContext = {
        requestId,
        method: req.method,
        ip: req.ip,
        userAgent: req.get("user-agent") ?? undefined,
        startedAt: Date.now(),
    };

    req.context = context;

    runWithRequestContext(context, () => {
        next();
    });
}

/**
 * Logs one structured line per completed request.
 *
 * Status, latency, route template and request id are included so an
 * incident can be reconstructed from logs alone.
 */
export function requestLoggingMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const startedAt = process.hrtime.bigint();

    res.on("finish", () => {
        const durationMs =
            Number(process.hrtime.bigint() - startedAt) / 1_000_000;

        const route = getRouteTemplate(req);

        // Keep the context in sync for anything that reads it later.
        updateRequestContext({route});

        const context = req.context;

        const logPayload = {
            requestId: context?.requestId,
            method: req.method,
            route: route ?? req.path,
            status: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            userId: context?.userId,
            ip: context?.ip,
            userAgent: context?.userAgent,
        };

        if (res.statusCode >= 500) {
            logger.error(logPayload, "Request failed");
            return;
        }

        if (res.statusCode >= 400) {
            logger.warn(logPayload, "Request rejected");
            return;
        }

        logger.info(logPayload, "Request completed");
    });

    next();
}
