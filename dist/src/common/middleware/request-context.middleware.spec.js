"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const request_context_middleware_1 = require("./request-context.middleware");
const request_context_1 = require("../context/request-context");
vitest_1.vi.mock("../../config/logger", () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)("request-context middleware", () => {
    let req;
    let res;
    let next;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        req = {
            method: "GET",
            path: "/api/v1/users",
            headers: {},
            get: vitest_1.vi.fn().mockReturnValue(undefined),
        };
        res = {
            setHeader: vitest_1.vi.fn(),
            on: vitest_1.vi.fn(),
        };
        next = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("requestContextMiddleware()", () => {
        (0, vitest_1.it)("generates a request id when the client does not supply one", () => {
            (0, request_context_middleware_1.requestContextMiddleware)(req, res, next);
            (0, vitest_1.expect)(res.setHeader).toHaveBeenCalledWith("X-Request-ID", vitest_1.expect.any(String));
            (0, vitest_1.expect)(next).toHaveBeenCalledTimes(1);
        });
        (0, vitest_1.it)("uses a valid client-supplied request id", () => {
            req.headers["x-request-id"] =
                "client-abc-123";
            (0, request_context_middleware_1.requestContextMiddleware)(req, res, next);
            (0, vitest_1.expect)(res.setHeader).toHaveBeenCalledWith("X-Request-ID", "client-abc-123");
        });
        (0, vitest_1.it)("rejects an unsafe client-supplied request id", () => {
            req.headers["x-request-id"] =
                "bad id with spaces";
            (0, request_context_middleware_1.requestContextMiddleware)(req, res, next);
            (0, vitest_1.expect)(res.setHeader).toHaveBeenCalledWith("X-Request-ID", vitest_1.expect.not.stringContaining(" "));
        });
        (0, vitest_1.it)("rejects an over-long client-supplied request id", () => {
            req.headers["x-request-id"] =
                "a".repeat(200);
            (0, request_context_middleware_1.requestContextMiddleware)(req, res, next);
            const [, value] = res.setHeader.mock
                .calls[0];
            (0, vitest_1.expect)(value.length).toBeLessThanOrEqual(128);
        });
        (0, vitest_1.it)("attaches the context to the request", () => {
            var _a, _b;
            (0, request_context_middleware_1.requestContextMiddleware)(req, res, next);
            (0, vitest_1.expect)((_a = req.context) === null || _a === void 0 ? void 0 : _a.requestId).toBeTruthy();
            (0, vitest_1.expect)((_b = req.context) === null || _b === void 0 ? void 0 : _b.method).toBe("GET");
        });
        (0, vitest_1.it)("makes the context available to the rest of the chain", () => {
            var _a;
            let observed;
            (0, request_context_middleware_1.requestContextMiddleware)(req, res, () => {
                var _a;
                observed = (_a = (0, request_context_1.getRequestContext)()) === null || _a === void 0 ? void 0 : _a.requestId;
            });
            (0, vitest_1.expect)(observed).toBe((_a = req.context) === null || _a === void 0 ? void 0 : _a.requestId);
        });
    });
    (0, vitest_1.describe)("requestLoggingMiddleware()", () => {
        (0, vitest_1.it)("registers a finish listener and calls next", () => {
            (0, request_context_middleware_1.requestLoggingMiddleware)(req, res, next);
            (0, vitest_1.expect)(res.on).toHaveBeenCalledWith("finish", vitest_1.expect.any(Function));
            (0, vitest_1.expect)(next).toHaveBeenCalledTimes(1);
        });
        (0, vitest_1.it)("logs a structured line when the response finishes", () => __awaiter(void 0, void 0, void 0, function* () {
            const { logger } = yield Promise.resolve().then(() => __importStar(require("../../config/logger")));
            let finishHandler = () => undefined;
            res.on.mockImplementation((event, handler) => {
                if (event === "finish") {
                    finishHandler = handler;
                }
            });
            (0, request_context_middleware_1.requestLoggingMiddleware)(req, res, next);
            res.statusCode = 200;
            finishHandler();
            (0, vitest_1.expect)(logger.info).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                method: "GET",
                status: 200,
            }), "Request completed");
        }));
    });
    (0, vitest_1.describe)("getRouteTemplate()", () => {
        (0, vitest_1.it)("returns undefined before the route is matched", () => {
            (0, vitest_1.expect)((0, request_context_middleware_1.getRouteTemplate)(req)).toBeUndefined();
        });
        (0, vitest_1.it)("returns the matched route template", () => {
            req.route = {
                path: "/users/:id",
            };
            (0, vitest_1.expect)((0, request_context_middleware_1.getRouteTemplate)(req)).toBe("/users/:id");
        });
    });
    (0, vitest_1.describe)("request context", () => {
        (0, vitest_1.it)("returns undefined outside a context", () => {
            (0, vitest_1.expect)((0, request_context_1.getRequestContext)()).toBeUndefined();
        });
        (0, vitest_1.it)("returns the context inside a scope", () => {
            (0, request_context_1.runWithRequestContext)({
                requestId: "abc",
                method: "GET",
                startedAt: Date.now(),
            }, () => {
                var _a;
                (0, vitest_1.expect)((_a = (0, request_context_1.getRequestContext)()) === null || _a === void 0 ? void 0 : _a.requestId).toBe("abc");
            });
        });
    });
});
