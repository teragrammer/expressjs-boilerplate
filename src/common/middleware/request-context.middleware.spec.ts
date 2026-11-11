import {NextFunction, Request, Response} from "express";
import {beforeEach, describe, expect, it, vi} from "vitest";
import {
    getRouteTemplate,
    requestContextMiddleware,
    requestLoggingMiddleware,
} from "./request-context.middleware";
import {
    getRequestContext,
    runWithRequestContext,
} from "../context/request-context";

vi.mock("../../config/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("request-context middleware", () => {
    let req: Partial<Request>;
    let res: Partial<Response>;
    let next: ReturnType<typeof vi.fn> & NextFunction;

    beforeEach(() => {
        vi.clearAllMocks();

        req = {
            method: "GET",
            path: "/api/v1/users",
            headers: {},
            get: vi.fn().mockReturnValue(undefined),
        } as Partial<Request>;

        res = {
            setHeader: vi.fn(),
            on: vi.fn(),
        } as unknown as Response;

        next = vi.fn() as ReturnType<typeof vi.fn> & NextFunction;
    });

    describe("requestContextMiddleware()", () => {
        it("generates a request id when the client does not supply one", () => {
            requestContextMiddleware(req as Request, res as Response, next);

            expect(res.setHeader).toHaveBeenCalledWith(
                "X-Request-ID",
                expect.any(String),
            );
            expect(next).toHaveBeenCalledTimes(1);
        });

        it("uses a valid client-supplied request id", () => {
            (req.headers as Record<string, string>)["x-request-id"] =
                "client-abc-123";

            requestContextMiddleware(req as Request, res as Response, next);

            expect(res.setHeader).toHaveBeenCalledWith(
                "X-Request-ID",
                "client-abc-123",
            );
        });

        it("rejects an unsafe client-supplied request id", () => {
            (req.headers as Record<string, string>)["x-request-id"] =
                "bad id with spaces";

            requestContextMiddleware(req as Request, res as Response, next);

            expect(res.setHeader).toHaveBeenCalledWith(
                "X-Request-ID",
                expect.not.stringContaining(" "),
            );
        });

        it("rejects an over-long client-supplied request id", () => {
            (req.headers as Record<string, string>)["x-request-id"] =
                "a".repeat(200);

            requestContextMiddleware(req as Request, res as Response, next);

            const [, value] = (res.setHeader as ReturnType<typeof vi.fn>).mock
                .calls[0];

            expect(value.length).toBeLessThanOrEqual(128);
        });

        it("attaches the context to the request", () => {
            requestContextMiddleware(req as Request, res as Response, next);

            expect(req.context?.requestId).toBeTruthy();
            expect(req.context?.method).toBe("GET");
        });

        it("makes the context available to the rest of the chain", () => {
            let observed: string | undefined;

            requestContextMiddleware(req as Request, res as Response, () => {
                observed = getRequestContext()?.requestId;
            });

            expect(observed).toBe(req.context?.requestId);
        });
    });

    describe("requestLoggingMiddleware()", () => {
        it("registers a finish listener and calls next", () => {
            requestLoggingMiddleware(req as Request, res as Response, next);

            expect(res.on).toHaveBeenCalledWith(
                "finish",
                expect.any(Function),
            );
            expect(next).toHaveBeenCalledTimes(1);
        });

        it("logs a structured line when the response finishes", async () => {
            const {logger} = await import("../../config/logger");

            let finishHandler: () => void = () => undefined;

            (res.on as ReturnType<typeof vi.fn>).mockImplementation(
                (event: string, handler: () => void) => {
                    if (event === "finish") {
                        finishHandler = handler;
                    }
                },
            );

            requestLoggingMiddleware(req as Request, res as Response, next);

            (res as unknown as {statusCode: number}).statusCode = 200;

            finishHandler();

            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: "GET",
                    status: 200,
                }),
                "Request completed",
            );
        });
    });

    describe("getRouteTemplate()", () => {
        it("returns undefined before the route is matched", () => {
            expect(getRouteTemplate(req as Request)).toBeUndefined();
        });

        it("returns the matched route template", () => {
            (req as Request & {route?: {path?: string}}).route = {
                path: "/users/:id",
            };

            expect(getRouteTemplate(req as Request)).toBe("/users/:id");
        });
    });

    describe("request context", () => {
        it("returns undefined outside a context", () => {
            expect(getRequestContext()).toBeUndefined();
        });

        it("returns the context inside a scope", () => {
            runWithRequestContext(
                {
                    requestId: "abc",
                    method: "GET",
                    startedAt: Date.now(),
                },
                () => {
                    expect(getRequestContext()?.requestId).toBe("abc");
                },
            );
        });
    });
});
