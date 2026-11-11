"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRateLimiters = void 0;
exports.createRateLimiter = createRateLimiter;
const errors_1 = require("../utils/errors");
const messages_1 = __importDefault(require("../utils/messages"));
const rate_limiter_1 = require("./rate-limiter");
const defaultKeyGenerator = (req) => {
    return req.ip || "unknown";
};
function createRateLimiter(options) {
    const { bucket, maxRequests, windowMs, keyGenerator = defaultKeyGenerator, skipSuccessfulRequests = false, skipFailedRequests = false, message = "Too many requests, please try again later.", code = "RATE_LIMIT_EXCEEDED", } = options;
    const limiter = new rate_limiter_1.RateLimiter();
    return function rateLimiterMiddleware(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const key = `${bucket}:${keyGenerator(req)}`;
                const windowSec = Math.ceil(windowMs / 1000);
                const result = yield limiter.consume(key, maxRequests, windowSec);
                // Set rate limit headers
                res.setHeader("X-RateLimit-Limit", maxRequests);
                res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - result.count));
                res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + windowMs) / 1000));
                if (!result.allowed) {
                    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
                    res.setHeader("Retry-After", Math.max(1, retryAfter));
                    throw new errors_1.AppError(messages_1.default.RATE_LIMIT_EXCEEDED, message);
                }
                // Track response for conditional counting
                if (skipSuccessfulRequests || skipFailedRequests) {
                    const originalSend = res.send;
                    res.send = function (body) {
                        const statusCode = res.statusCode;
                        const isSuccess = statusCode >= 200 && statusCode < 400;
                        const shouldSkip = (skipSuccessfulRequests && isSuccess) ||
                            (skipFailedRequests && !isSuccess);
                        if (!shouldSkip) {
                            // Already counted in consume()
                        }
                        else {
                            // Decrement the count since we shouldn't count this request
                            limiter.decrement(key).catch(() => { });
                        }
                        return originalSend.call(this, body);
                    };
                }
                next();
            }
            catch (error) {
                next(error);
            }
        });
    };
}
// Pre-configured limiters for common endpoints - using shared limiter instances
const globalAuthLimiter = new rate_limiter_1.RateLimiter();
const registerLimiter = new rate_limiter_1.RateLimiter();
const loginLimiter = new rate_limiter_1.RateLimiter();
const passwordRecoverySendLimiter = new rate_limiter_1.RateLimiter();
const passwordRecoveryValidateLimiter = new rate_limiter_1.RateLimiter();
const tfaSendLimiter = new rate_limiter_1.RateLimiter();
const tfaValidateLimiter = new rate_limiter_1.RateLimiter();
const logoutLimiter = new rate_limiter_1.RateLimiter();
const refreshLimiter = new rate_limiter_1.RateLimiter();
function makeRateLimiter(limiter, options) {
    const { bucket, maxRequests, windowMs, keyGenerator = defaultKeyGenerator, skipSuccessfulRequests = false, skipFailedRequests = false, message = "Too many requests, please try again later.", code = "RATE_LIMIT_EXCEEDED", } = options;
    // In test environment, use very high limits to avoid interfering with tests
    const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";
    const testMaxRequests = isTest ? 10000 : maxRequests;
    const testWindowMs = isTest ? 1000 : windowMs; // 1 second window in tests
    return function rateLimiterMiddleware(req, res, next) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const key = `${bucket}:${keyGenerator(req)}`;
                const windowSec = Math.ceil(testWindowMs / 1000);
                const result = yield limiter.consume(key, testMaxRequests, windowSec);
                // Set rate limit headers
                res.setHeader("X-RateLimit-Limit", testMaxRequests);
                res.setHeader("X-RateLimit-Remaining", Math.max(0, testMaxRequests - result.count));
                res.setHeader("X-RateLimit-Reset", Math.ceil((Date.now() + testWindowMs) / 1000));
                if (!result.allowed) {
                    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000);
                    res.setHeader("Retry-After", Math.max(1, retryAfter));
                    throw new errors_1.AppError(messages_1.default.RATE_LIMIT_EXCEEDED, message);
                }
                // Track response for conditional counting
                if (skipSuccessfulRequests || skipFailedRequests) {
                    const originalSend = res.send;
                    res.send = function (body) {
                        const statusCode = res.statusCode;
                        const isSuccess = statusCode >= 200 && statusCode < 400;
                        const shouldSkip = (skipSuccessfulRequests && isSuccess) ||
                            (skipFailedRequests && !isSuccess);
                        if (!shouldSkip) {
                            // Already counted in consume()
                        }
                        else {
                            // Decrement the count since we shouldn't count this request
                            limiter.decrement(key).catch(() => { });
                        }
                        return originalSend.call(this, body);
                    };
                }
                next();
            }
            catch (error) {
                console.error("Rate limiter error:", error);
                next(error);
            }
        });
    };
}
// Pre-configured limiters for common endpoints - using shared limiter instances
exports.authRateLimiters = {
    login: makeRateLimiter(loginLimiter, {
        bucket: "auth:login",
        maxRequests: 10,
        windowMs: 60 * 1000, // 10 per minute
        keyGenerator: (req) => { var _a; return `ip:${req.ip}:user:${((_a = req.body) === null || _a === void 0 ? void 0 : _a.username) || "unknown"}`; },
        message: "Too many login attempts, please try again later.",
    }),
    register: makeRateLimiter(registerLimiter, {
        bucket: "auth:register",
        maxRequests: 5,
        windowMs: 60 * 60 * 1000, // 5 per hour
        message: "Too many registration attempts, please try again later.",
    }),
    passwordRecoverySend: makeRateLimiter(passwordRecoverySendLimiter, {
        bucket: "auth:password_recovery_send",
        maxRequests: 3,
        windowMs: 15 * 60 * 1000, // 3 per 15 minutes
        keyGenerator: (req) => { var _a; return `ip:${req.ip}:target:${((_a = req.body) === null || _a === void 0 ? void 0 : _a.send_to) || "unknown"}`; },
        message: "Too many password recovery requests, please try again later.",
    }),
    passwordRecoveryValidate: makeRateLimiter(passwordRecoveryValidateLimiter, {
        bucket: "auth:password_recovery_validate",
        maxRequests: 5,
        windowMs: 60 * 60 * 1000, // 5 per hour
        keyGenerator: (req) => { var _a; return `ip:${req.ip}:target:${((_a = req.body) === null || _a === void 0 ? void 0 : _a.send_to) || "unknown"}`; },
        message: "Too many validation attempts, please try again later.",
    }),
    tfaSend: makeRateLimiter(tfaSendLimiter, {
        bucket: "auth:tfa_send",
        maxRequests: 3,
        windowMs: 10 * 60 * 1000, // 3 per 10 minutes
        keyGenerator: (req) => { var _a, _b; return `user:${((_b = (_a = req.credentials) === null || _a === void 0 ? void 0 : _a.jwt) === null || _b === void 0 ? void 0 : _b.uid) || "unknown"}`; },
        message: "Too many OTP requests, please try again later.",
    }),
    tfaValidate: makeRateLimiter(tfaValidateLimiter, {
        bucket: "auth:tfa_validate",
        maxRequests: 5,
        windowMs: 60 * 60 * 1000, // 5 per hour
        keyGenerator: (req) => { var _a, _b; return `user:${((_b = (_a = req.credentials) === null || _a === void 0 ? void 0 : _a.jwt) === null || _b === void 0 ? void 0 : _b.uid) || "unknown"}`; },
        message: "Too many OTP validation attempts, please try again later.",
    }),
    logout: makeRateLimiter(logoutLimiter, {
        bucket: "auth:logout",
        maxRequests: 20,
        windowMs: 60 * 1000, // 20 per minute
        message: "Too many logout attempts.",
    }),
    refresh: makeRateLimiter(refreshLimiter, {
        bucket: "auth:refresh",
        maxRequests: 30,
        windowMs: 60 * 1000, // 30 per minute
        message: "Too many token refresh attempts, please try again later.",
    }),
    globalAuth: makeRateLimiter(globalAuthLimiter, {
        bucket: "auth:global",
        maxRequests: 100,
        windowMs: 60 * 1000, // 100 per minute global
        message: "Too many authentication requests, please try again later.",
    }),
};
