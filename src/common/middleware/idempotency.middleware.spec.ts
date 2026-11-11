import {NextFunction, Request, Response} from "express";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {
    canonicalize,
    hashRequest,
    idempotency,
} from "./idempotency.middleware";

vi.mock("../../config/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

const selectRows: any[] = [];
const insertCalls: any[] = [];
const insertResult: any[] = [];
const updateCalls: any[] = [];

vi.mock("../../config/database", () => ({
    db: {
        insertInto: vi.fn(() => ({
            values: vi.fn(() => ({
                onConflict: vi.fn(() => ({
                    returning: vi.fn(() => ({
                        executeTakeFirst: vi.fn(async () => {
                            insertCalls.push(true);

                            // A conflict returns no row.
                            return insertResult[0] === false
                                ? undefined
                                : {id: "new"};
                        }),
                    })),
                })),
            })),
        })),
        selectFrom: vi.fn(() => {
            const builder: any = {
                selectAll: vi.fn(() => builder),
                where: vi.fn(() => builder),
                executeTakeFirst: vi.fn(async () => selectRows[0] ?? null),
            };

            return builder;
        }),
        updateTable: vi.fn(() => {
            const builder: any = {
                set: vi.fn((values: unknown) => {
                    updateCalls.push(values);
                    return builder;
                }),
                where: vi.fn(() => builder),
                execute: vi.fn(async () => undefined),
            };

            return builder;
        }),
    },
}));

describe("idempotency middleware", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: ReturnType<typeof vi.fn> & NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();
        selectRows.length = 0;
        insertCalls.length = 0;
        insertResult.length = 0;
        updateCalls.length = 0;

        req = {
            method: "POST",
            headers: {},
            body: {name: "value"},
            sanitize: {data: {name: "value"}},
            credentials: {jwt: {uid: 7, tid: 1, tfa: true}},
        } as unknown as Partial<Request>;

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            setHeader: vi.fn(),
        } as unknown as Response;

        next = vi.fn() as ReturnType<typeof vi.fn> & NextFunction;
    });

    describe("canonicalize()", () => {
        it("sorts the object keys", () => {
            expect(canonicalize({b: 1, a: 2})).toBe(
                canonicalize({a: 2, b: 1}),
            );
        });

        it("handles nested objects and arrays", () => {
            expect(canonicalize({a: {c: 1, b: 2}})).toBe(
                '{"a":{"b":2,"c":1}}',
            );
            expect(canonicalize([1, "two"])).toBe('[1,"two"]');
        });

        it("handles primitives and null", () => {
            expect(canonicalize(null)).toBe("null");
            expect(canonicalize(undefined)).toBe("null");
            expect(canonicalize(5)).toBe("5");
        });

        it("drops undefined values", () => {
            expect(canonicalize({a: 1, b: undefined})).toBe('{"a":1}');
        });
    });

    describe("hashRequest()", () => {
        it("produces a stable hash", () => {
            expect(hashRequest({a: 1, b: 2})).toBe(
                hashRequest({b: 2, a: 1}),
            );
        });

        it("produces a different hash for a different payload", () => {
            expect(hashRequest({a: 1})).not.toBe(hashRequest({a: 2}));
        });
    });

    describe("idempotency()", () => {
        it("passes the request through when no key is supplied", async () => {
            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
        });

        it("rejects an over-long key", async () => {
            (req.headers as Record<string, string>)["idempotency-key"] =
                "a".repeat(300);

            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({statusCode: 400}),
            );
        });

        it("reserves the key and continues", async () => {
            (req.headers as Record<string, string>)["idempotency-key"] =
                "key-1";

            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(insertCalls).toHaveLength(1);
            expect(next).toHaveBeenCalledWith();
        });

        it("rejects the request when another one won the race", async () => {
            (req.headers as Record<string, string>)["idempotency-key"] =
                "key-race";

            // The insert conflicted, so no row was returned.
            insertResult.push(false);

            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({statusCode: 409}),
            );
        });

        it("replays a stored response", async () => {
            (req.headers as Record<string, string>)["idempotency-key"] =
                "key-2";

            selectRows.push({
                id: "2",
                key: "key-2",
                route: "test",
                request_hash: hashRequest({name: "value"}),
                status: "completed",
                locked_at: new Date(),
                response_status: 201,
                response_body: {id: 5},
            });

            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(res.setHeader).toHaveBeenCalledWith(
                "Idempotency-Replayed",
                "true",
            );
            expect(res.json).toHaveBeenCalledWith({id: 5});
            expect(next).not.toHaveBeenCalled();
        });

        it("rejects a key reused with a different payload", async () => {
            (req.headers as Record<string, string>)["idempotency-key"] =
                "key-3";

            selectRows.push({
                id: "3",
                key: "key-3",
                route: "test",
                request_hash: hashRequest({name: "different"}),
                status: "in_progress",
                locked_at: new Date(),
                response_status: null,
                response_body: null,
            });

            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({statusCode: 409}),
            );
        });

        it("rejects a duplicate while the first request is in flight", async () => {
            (req.headers as Record<string, string>)["idempotency-key"] =
                "key-4";

            selectRows.push({
                id: "4",
                key: "key-4",
                route: "test",
                request_hash: hashRequest({name: "value"}),
                status: "in_progress",
                locked_at: new Date(),
                response_status: null,
                response_body: null,
            });

            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith(
                expect.objectContaining({statusCode: 409}),
            );
        });

        it("takes over an expired reservation", async () => {
            (req.headers as Record<string, string>)["idempotency-key"] =
                "key-5";

            selectRows.push({
                id: "5",
                key: "key-5",
                route: "test",
                request_hash: hashRequest({name: "value"}),
                status: "in_progress",
                locked_at: new Date(Date.now() - 120_000),
                response_status: null,
                response_body: null,
            });

            const middleware = idempotency({scope: "test"});

            await middleware(req as Request, res as Response, next);

            expect(next).toHaveBeenCalledWith();
            expect(updateCalls.length).toBeGreaterThan(0);
        });
    });
});
