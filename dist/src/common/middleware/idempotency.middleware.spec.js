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
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const idempotency_middleware_1 = require("./idempotency.middleware");
vitest_1.vi.mock("../../config/logger", () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    },
}));
const selectRows = [];
const insertCalls = [];
const insertResult = [];
const updateCalls = [];
vitest_1.vi.mock("../../config/database", () => ({
    db: {
        insertInto: vitest_1.vi.fn(() => ({
            values: vitest_1.vi.fn(() => ({
                onConflict: vitest_1.vi.fn(() => ({
                    returning: vitest_1.vi.fn(() => ({
                        executeTakeFirst: vitest_1.vi.fn(() => __awaiter(void 0, void 0, void 0, function* () {
                            insertCalls.push(true);
                            // A conflict returns no row.
                            return insertResult[0] === false
                                ? undefined
                                : { id: "new" };
                        })),
                    })),
                })),
            })),
        })),
        selectFrom: vitest_1.vi.fn(() => {
            const builder = {
                selectAll: vitest_1.vi.fn(() => builder),
                where: vitest_1.vi.fn(() => builder),
                executeTakeFirst: vitest_1.vi.fn(() => __awaiter(void 0, void 0, void 0, function* () { var _a; return (_a = selectRows[0]) !== null && _a !== void 0 ? _a : null; })),
            };
            return builder;
        }),
        updateTable: vitest_1.vi.fn(() => {
            const builder = {
                set: vitest_1.vi.fn((values) => {
                    updateCalls.push(values);
                    return builder;
                }),
                where: vitest_1.vi.fn(() => builder),
                execute: vitest_1.vi.fn(() => __awaiter(void 0, void 0, void 0, function* () { return undefined; })),
            };
            return builder;
        }),
    },
}));
(0, vitest_1.describe)("idempotency middleware", () => {
    let req;
    let res;
    let next;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        selectRows.length = 0;
        insertCalls.length = 0;
        insertResult.length = 0;
        updateCalls.length = 0;
        req = {
            method: "POST",
            headers: {},
            body: { name: "value" },
            sanitize: { data: { name: "value" } },
            credentials: { jwt: { uid: 7, tid: 1, tfa: true } },
        };
        res = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn(),
            setHeader: vitest_1.vi.fn(),
        };
        next = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("canonicalize()", () => {
        (0, vitest_1.it)("sorts the object keys", () => {
            (0, vitest_1.expect)((0, idempotency_middleware_1.canonicalize)({ b: 1, a: 2 })).toBe((0, idempotency_middleware_1.canonicalize)({ a: 2, b: 1 }));
        });
        (0, vitest_1.it)("handles nested objects and arrays", () => {
            (0, vitest_1.expect)((0, idempotency_middleware_1.canonicalize)({ a: { c: 1, b: 2 } })).toBe('{"a":{"b":2,"c":1}}');
            (0, vitest_1.expect)((0, idempotency_middleware_1.canonicalize)([1, "two"])).toBe('[1,"two"]');
        });
        (0, vitest_1.it)("handles primitives and null", () => {
            (0, vitest_1.expect)((0, idempotency_middleware_1.canonicalize)(null)).toBe("null");
            (0, vitest_1.expect)((0, idempotency_middleware_1.canonicalize)(undefined)).toBe("null");
            (0, vitest_1.expect)((0, idempotency_middleware_1.canonicalize)(5)).toBe("5");
        });
        (0, vitest_1.it)("drops undefined values", () => {
            (0, vitest_1.expect)((0, idempotency_middleware_1.canonicalize)({ a: 1, b: undefined })).toBe('{"a":1}');
        });
    });
    (0, vitest_1.describe)("hashRequest()", () => {
        (0, vitest_1.it)("produces a stable hash", () => {
            (0, vitest_1.expect)((0, idempotency_middleware_1.hashRequest)({ a: 1, b: 2 })).toBe((0, idempotency_middleware_1.hashRequest)({ b: 2, a: 1 }));
        });
        (0, vitest_1.it)("produces a different hash for a different payload", () => {
            (0, vitest_1.expect)((0, idempotency_middleware_1.hashRequest)({ a: 1 })).not.toBe((0, idempotency_middleware_1.hashRequest)({ a: 2 }));
        });
    });
    (0, vitest_1.describe)("idempotency()", () => {
        (0, vitest_1.it)("passes the request through when no key is supplied", () => __awaiter(void 0, void 0, void 0, function* () {
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
        }));
        (0, vitest_1.it)("rejects an over-long key", () => __awaiter(void 0, void 0, void 0, function* () {
            req.headers["idempotency-key"] =
                "a".repeat(300);
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ statusCode: 400 }));
        }));
        (0, vitest_1.it)("reserves the key and continues", () => __awaiter(void 0, void 0, void 0, function* () {
            req.headers["idempotency-key"] =
                "key-1";
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(insertCalls).toHaveLength(1);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
        }));
        (0, vitest_1.it)("rejects the request when another one won the race", () => __awaiter(void 0, void 0, void 0, function* () {
            req.headers["idempotency-key"] =
                "key-race";
            // The insert conflicted, so no row was returned.
            insertResult.push(false);
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ statusCode: 409 }));
        }));
        (0, vitest_1.it)("replays a stored response", () => __awaiter(void 0, void 0, void 0, function* () {
            req.headers["idempotency-key"] =
                "key-2";
            selectRows.push({
                id: "2",
                key: "key-2",
                route: "test",
                request_hash: (0, idempotency_middleware_1.hashRequest)({ name: "value" }),
                status: "completed",
                locked_at: new Date(),
                response_status: 201,
                response_body: { id: 5 },
            });
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(res.setHeader).toHaveBeenCalledWith("Idempotency-Replayed", "true");
            (0, vitest_1.expect)(res.json).toHaveBeenCalledWith({ id: 5 });
            (0, vitest_1.expect)(next).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("rejects a key reused with a different payload", () => __awaiter(void 0, void 0, void 0, function* () {
            req.headers["idempotency-key"] =
                "key-3";
            selectRows.push({
                id: "3",
                key: "key-3",
                route: "test",
                request_hash: (0, idempotency_middleware_1.hashRequest)({ name: "different" }),
                status: "in_progress",
                locked_at: new Date(),
                response_status: null,
                response_body: null,
            });
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ statusCode: 409 }));
        }));
        (0, vitest_1.it)("rejects a duplicate while the first request is in flight", () => __awaiter(void 0, void 0, void 0, function* () {
            req.headers["idempotency-key"] =
                "key-4";
            selectRows.push({
                id: "4",
                key: "key-4",
                route: "test",
                request_hash: (0, idempotency_middleware_1.hashRequest)({ name: "value" }),
                status: "in_progress",
                locked_at: new Date(),
                response_status: null,
                response_body: null,
            });
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith(vitest_1.expect.objectContaining({ statusCode: 409 }));
        }));
        (0, vitest_1.it)("takes over an expired reservation", () => __awaiter(void 0, void 0, void 0, function* () {
            req.headers["idempotency-key"] =
                "key-5";
            selectRows.push({
                id: "5",
                key: "key-5",
                route: "test",
                request_hash: (0, idempotency_middleware_1.hashRequest)({ name: "value" }),
                status: "in_progress",
                locked_at: new Date(Date.now() - 120000),
                response_status: null,
                response_body: null,
            });
            const middleware = (0, idempotency_middleware_1.idempotency)({ scope: "test" });
            yield middleware(req, res, next);
            (0, vitest_1.expect)(next).toHaveBeenCalledWith();
            (0, vitest_1.expect)(updateCalls.length).toBeGreaterThan(0);
        }));
    });
});
