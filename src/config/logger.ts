// src/config/logger.ts
import pino from "pino";
import {__ENV} from "./environment";

/**
 * Paths whose values must never reach a log sink.
 *
 * Redaction is applied by pino before serialization, so the values are
 * removed from the log line rather than formatted afterwards.
 */
export const REDACT_PATHS = [
    "req.headers.authorization",
    "req.headers.cookie",
    "req.headers.set-cookie",
    "res.headers.set-cookie",
    "headers.authorization",
    "headers.cookie",
    "headers[\"set-cookie\"]",
    "password",
    "new_password",
    "current_password",
    "password_confirmation",
    "code",
    "token",
    "access_token",
    "refresh_token",
    "authorization",
    "secret",
    "apiKey",
    "api_key",
    "*.password",
    "*.new_password",
    "*.current_password",
    "*.code",
    "*.token",
    "*.refresh_token",
    "*.secret",
];

/**
 * Builds the pino logger.
 *
 * Production emits structured JSON so log shippers can parse it.
 * Development uses `pino-pretty` for a readable console.
 */
function createLogger() {
    const isProduction = __ENV.NODE_ENV === "production";

    const options = {
        level: __ENV.LOG_LEVEL,
        redact: {
            paths: REDACT_PATHS,
            censor: "[REDACTED]",
        },
        base: {
            service: "express-api",
            env: __ENV.NODE_ENV,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
    };

    if (isProduction) {
        return pino(options);
    }

    return pino({
        ...options,
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
            },
        },
    });
}

export const logger = createLogger();
