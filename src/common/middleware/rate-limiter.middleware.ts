// src/common/middleware/rate-limiter.middleware.ts
import {NextFunction, Request, Response} from "express";
import {AppError} from "../utils/errors";
import Messages from "../utils/messages";
import {RateLimiter} from "./rate-limiter.service";
import {logger} from "../../config/logger";
import {createHash} from "node:crypto";
import {rateLimitRejectionsTotal} from "../metrics/metrics";

export interface RateLimitOptions {
    bucket: string;
    maxRequests: number;
    windowMs: number;
    keyGenerator?: (req: Request) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    message?: string;
    code?: string;
    failClosed?: boolean;
}

const defaultKeyGenerator = (req: Request): string => {
    return req.ip || "unknown";
};

/**
 * Hashes an identifier for the log.
 *
 * The hash lets an operator correlate the throttled client across
 * requests without the log recording the identifier itself.
 */
const hashIdentifier = (value: string): string =>
    createHash("sha256").update(value).digest("hex").slice(0, 16);

export function createRateLimiter(options: RateLimitOptions) {
    const {
        bucket,
        maxRequests,
        windowMs,
        keyGenerator = defaultKeyGenerator,
        skipSuccessfulRequests = false,
        skipFailedRequests = false,
        message = "Too many requests, please try again later.",
        code = "RATE_LIMIT_EXCEEDED",
        failClosed = false,
    } = options;

    const limiter = new RateLimiter();

    return async function rateLimiterMiddleware(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            const rawIdentifier = keyGenerator(req);
            const hashedIdentifier = createHash("sha256")
                .update(rawIdentifier)
                .digest("hex");
            const key = `${bucket}:${hashedIdentifier}`;
            const windowSec = Math.ceil(windowMs / 1000);

            const result = await limiter.consume(
                key,
                maxRequests,
                windowSec,
                failClosed,
            );

            // Set rate limit headers
            res.setHeader("X-RateLimit-Limit", maxRequests);
            res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - result.count));
            res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + windowMs) / 1000));

            if (!result.allowed) {
                const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
                res.setHeader("Retry-After", Math.max(1, retryAfter));

                /*
                 * The rejected identifier is hashed so the log can
                 * show which client was throttled without recording
                 * the identifier itself.
                 */
                logger.warn(
                    {
                        bucket,
                        key: hashIdentifier(key),
                        count: result.count,
                    },
                    "Rate limit exceeded",
                );

                rateLimitRejectionsTotal.inc({bucket});

                throw new AppError(
                    Messages.RATE_LIMIT_EXCEEDED,
                    message,
                    code,
                );
            }

            // Track response for conditional counting
            if (skipSuccessfulRequests || skipFailedRequests) {
                const originalSend = res.send;
                res.send = function (body?: any): Response {
                    const statusCode = res.statusCode;
                    const isSuccess = statusCode >= 200 && statusCode < 400;
                    const shouldSkip = (skipSuccessfulRequests && isSuccess) ||
                        (skipFailedRequests && !isSuccess);

                    if (!shouldSkip) {
                        // Already counted in consume()
                    } else {
                        // Decrement the count since we shouldn't count this request
                        limiter.decrement(key).catch(() => {});
                    }

                    return originalSend.call(this, body);
                };
            }

            next();
        } catch (error) {
            next(error);
        }
    };
}

/**
 * Runtime switch for the rate limiter.
 *
 * The limits are enforced by default. The switch exists so a test can
 * exercise the real limits without the rest of the suite tripping over
 * them; it is never disabled in production.
 */
export const rateLimitControl = {enabled: true};

/**
 * Pre-configured limiters for common endpoints - using shared limiter instances
 */
const globalAuthLimiter = new RateLimiter();
const registerLimiter = new RateLimiter();
const loginLimiter = new RateLimiter();
const passwordRecoverySendLimiter = new RateLimiter();
const passwordRecoveryValidateLimiter = new RateLimiter();
const tfaSendLimiter = new RateLimiter();
const tfaValidateLimiter = new RateLimiter();
const logoutLimiter = new RateLimiter();
const refreshLimiter = new RateLimiter();
const verificationSendLimiter = new RateLimiter();
const verificationConfirmLimiter = new RateLimiter();

function makeRateLimiter(limiter: RateLimiter, options: RateLimitOptions) {
    const {
        bucket,
        maxRequests,
        windowMs,
        keyGenerator = defaultKeyGenerator,
        skipSuccessfulRequests = false,
        skipFailedRequests = false,
        message = "Too many requests, please try again later.",
        code = "RATE_LIMIT_EXCEEDED",
        failClosed = false,
    } = options;

    return async function rateLimiterMiddleware(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        if (!rateLimitControl.enabled) {
            next();
            return;
        }

        try {
            const rawIdentifier = keyGenerator(req);
            const hashedIdentifier = createHash("sha256")
                .update(rawIdentifier)
                .digest("hex");
            const key = `${bucket}:${hashedIdentifier}`;
            const windowSec = Math.ceil(windowMs / 1000);

            const result = await limiter.consume(
                key,
                maxRequests,
                windowSec,
                failClosed,
            );

            // Set rate limit headers
            res.setHeader("X-RateLimit-Limit", maxRequests);
            res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - result.count));
            res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + windowMs) / 1000));

            if (!result.allowed) {
                const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
                res.setHeader("Retry-After", Math.max(1, retryAfter));

                /*
                 * The rejected identifier is hashed so the log can
                 * show which client was throttled without recording
                 * the identifier itself.
                 */
                logger.warn(
                    {
                        bucket,
                        key: hashIdentifier(key),
                        count: result.count,
                    },
                    "Rate limit exceeded",
                );

                rateLimitRejectionsTotal.inc({bucket});

                throw new AppError(
                    Messages.RATE_LIMIT_EXCEEDED,
                    message,
                    code,
                );
            }

            // Track response for conditional counting
            if (skipSuccessfulRequests || skipFailedRequests) {
                const originalSend = res.send;
                res.send = function (body?: any): Response {
                    const statusCode = res.statusCode;
                    const isSuccess = statusCode >= 200 && statusCode < 400;
                    const shouldSkip = (skipSuccessfulRequests && isSuccess) ||
                        (skipFailedRequests && !isSuccess);

                    if (!shouldSkip) {
                        // Already counted in consume()
                    } else {
                        // Decrement the count since we shouldn't count this request
                        limiter.decrement(key).catch(() => {});
                    }

                    return originalSend.call(this, body);
                };
            }

            next();
        } catch (error) {
            /*
             * The 429 the limiter raises is an expected outcome, not
             * an internal failure: it is forwarded without an error
             * log.
             */
            if (error instanceof AppError) {
                next(error);
                return;
            }

            logger.error(
                {message: (error as Error).message},
                "Rate limiter error",
            );
            next(error);
        }
    };
}

// Pre-configured limiters for common endpoints - using shared limiter instances
export const authRateLimiters = {
    login: makeRateLimiter(loginLimiter, {
        bucket: "auth:login",
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 per minute
        keyGenerator: (req) => `ip:${req.ip}:user:${req.body?.username || "unknown"}`,
failClosed: true,
        message: "Too many login attempts, please try again later.",
    }),

    register: makeRateLimiter(registerLimiter, {
        bucket: "auth:register",
        maxRequests: 5,
        windowMs: 60 * 60 * 1000, // 5 per hour
failClosed: true,
        message: "Too many registration attempts, please try again later.",
    }),

    passwordRecoverySend: makeRateLimiter(passwordRecoverySendLimiter, {
        bucket: "auth:password_recovery_send",
        maxRequests: 3,
        windowMs: 15 * 60 * 1000, // 3 per 15 minutes
        keyGenerator: (req) => `ip:${req.ip}:target:${req.body?.send_to || "unknown"}`,
failClosed: true,
        message: "Too many password recovery requests, please try again later.",
    }),

    passwordRecoveryValidate: makeRateLimiter(passwordRecoveryValidateLimiter, {
        bucket: "auth:password_recovery_validate",
        maxRequests: 5,
        windowMs: 60 * 60 * 1000, // 5 per hour
        keyGenerator: (req) => `ip:${req.ip}:target:${req.body?.send_to || "unknown"}`,
failClosed: true,
        message: "Too many validation attempts, please try again later.",
    }),

    tfaSend: makeRateLimiter(tfaSendLimiter, {
        bucket: "auth:tfa_send",
        maxRequests: 3,
        windowMs: 10 * 60 * 1000, // 3 per 10 minutes
        keyGenerator: (req) => `user:${req.credentials?.jwt?.uid || "unknown"}`,
failClosed: true,
        message: "Too many OTP requests, please try again later.",
    }),

    tfaValidate: makeRateLimiter(tfaValidateLimiter, {
        bucket: "auth:tfa_validate",
        maxRequests: 5,
        windowMs: 60 * 60 * 1000, // 5 per hour
        keyGenerator: (req) => `user:${req.credentials?.jwt?.uid || "unknown"}`,
failClosed: true,
        message: "Too many OTP validation attempts, please try again later.",
    }),

    logout: makeRateLimiter(logoutLimiter, {
        bucket: "auth:logout",
        maxRequests: 20,
        windowMs: 60 * 1000, // 20 per minute
failClosed: true,
        message: "Too many logout attempts.",
    }),

    refresh: makeRateLimiter(refreshLimiter, {
        bucket: "auth:refresh",
        maxRequests: 30,
        windowMs: 60 * 1000, // 30 per minute
failClosed: true,
        message: "Too many token refresh attempts, please try again later.",
    }),

    verificationSend: makeRateLimiter(verificationSendLimiter, {
        bucket: "auth:verification_send",
        maxRequests: 3,
        windowMs: 15 * 60 * 1000, // 3 per 15 minutes
        keyGenerator: (req) =>
            `user:${req.credentials?.jwt?.uid || "unknown"}`,
failClosed: true,
        message: "Too many verification requests, please try again later.",
    }),

    verificationConfirm: makeRateLimiter(verificationConfirmLimiter, {
        bucket: "auth:verification_confirm",
        maxRequests: 5,
        windowMs: 15 * 60 * 1000, // 5 per 15 minutes
        keyGenerator: (req) =>
            `user:${req.credentials?.jwt?.uid || "unknown"}`,
failClosed: true,
        message: "Too many verification attempts, please try again later.",
    }),

    globalAuth: makeRateLimiter(globalAuthLimiter, {
        bucket: "auth:global",
        maxRequests: 100,
        windowMs: 60 * 1000, // 100 per minute global
failClosed: true,
        message: "Too many authentication requests, please try again later.",
    }),
};