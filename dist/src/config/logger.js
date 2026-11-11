"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.REDACT_PATHS = void 0;
// src/config/logger.ts
const pino_1 = __importDefault(require("pino"));
const environment_1 = require("./environment");
/**
 * Paths whose values must never reach a log sink.
 *
 * Redaction is applied by pino before serialization, so the values are
 * removed from the log line rather than formatted afterwards.
 */
exports.REDACT_PATHS = [
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
    const isProduction = environment_1.__ENV.NODE_ENV === "production";
    const options = {
        level: environment_1.__ENV.LOG_LEVEL,
        redact: {
            paths: exports.REDACT_PATHS,
            censor: "[REDACTED]",
        },
        base: {
            service: "express-api",
            env: environment_1.__ENV.NODE_ENV,
        },
        timestamp: pino_1.default.stdTimeFunctions.isoTime,
    };
    if (isProduction) {
        return (0, pino_1.default)(options);
    }
    return (0, pino_1.default)(Object.assign(Object.assign({}, options), { transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
            },
        } }));
}
exports.logger = createLogger();
