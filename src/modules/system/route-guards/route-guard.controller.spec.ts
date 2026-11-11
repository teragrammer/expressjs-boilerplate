// __test__/modules/system/controllers/route-guard.controller.spec.ts
import {beforeEach, describe, expect, it, vi,} from "vitest";
import {NextFunction, Request, Response,} from "express";

import {RouteGuardController} from "./route-guard.controller";
import {RouteGuardService} from "./route-guard.service";
import {
    BrowseRouteGuardQuery,
    CreateRouteGuardDTO,
    RouteGuard,
    RouteGuardRow,
} from "./route-guard.interface";
import {AppError} from "../../../common/utils/errors";

const {
    mockCreateRouteGuard,
    mockBrowseRouteGuards,
    mockFindById,
    mockHardDelete,
} = vi.hoisted(() => ({
    mockCreateRouteGuard: vi.fn(),
    mockBrowseRouteGuards: vi.fn(),
    mockFindById: vi.fn(),
    mockHardDelete: vi.fn(),
}));

vi.mock(
    "../../../../src/common/utils/catch-async",
    () => ({
        default: (fn: any) =>
            (req: any, res: any, next: any) =>
                Promise.resolve(fn(req, res, next)).catch(next),
    }),
);

describe("RouteGuardController", () => {
    let controller: RouteGuardController;

    let req: Partial<Request> & {
        sanitize?: any;
        params?: Record<string, string>;
    };

    let res: Partial<Response>;
    let next: NextFunction;

    const routeGuard: RouteGuardRow = {
        id: 1,
        role_id: 10,
        route: "/admin/users",
        role_slug: "administrator",
        created_at: new Date(),
        updated_at: new Date(),
    };

    const invoke = async (
        method:
            | "create"
            | "browse"
            | "view"
            | "delete",
    ) => {
        await controller[method](
            req as Request,
            res as Response,
            next,
        );
    };

    const expectJsonResponse = (
        statusCode: number,
        data: unknown,
    ) => {
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(statusCode);

        expect(res.json).toHaveBeenCalledTimes(1);
        expect(res.json).toHaveBeenCalledWith(data);

        expect(res.send).not.toHaveBeenCalled();

        expect(next).not.toHaveBeenCalled();
    };

    const expectSendResponse = (
        statusCode: number,
    ) => {
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(statusCode);

        expect(res.send).toHaveBeenCalledTimes(1);
        expect(res.send).toHaveBeenCalledWith();

        expect(res.json).not.toHaveBeenCalled();

        expect(next).not.toHaveBeenCalled();
    };

    const expectErrorForwarded = (
        error: unknown,
    ) => {
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
        expect(res.send).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        vi.resetAllMocks();

        const routeGuardService = {
            createRouteGuard: mockCreateRouteGuard,
            browseRouteGuards: mockBrowseRouteGuards,
            findById: mockFindById,
            hardDelete: mockHardDelete,
        } as unknown as RouteGuardService;

        controller = new RouteGuardController(
            routeGuardService,
        );

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
        };

        next = vi.fn();

        req = {
            params: {
                id: "1",
            },

            sanitize: {
                body: {
                    only: vi.fn(),
                    get: vi.fn(),
                    numeric: vi.fn(),
                },

                query: {
                    only: vi.fn(),
                    get: vi.fn(),
                    numeric: vi.fn(),
                },

                data: {
                    role_id: 10,
                    route: "/admin/users",
                },
            },

            app: {
                get: vi.fn().mockReturnValue({
                    page: 1,
                    perPage: 20,
                }),
            } as any,
        };
    });

    describe("create()", () => {
        it("should create a route guard and return the created route guard ID", async () => {
            const createData: CreateRouteGuardDTO = {
                role_id: 10,
                route: "/admin/users",
            };

            const createdRouteGuard: RouteGuard = {
                id: 42,
                role_id: 10,
                route: "/admin/users",
                created_at: new Date(),
                updated_at: new Date(),
            };

            req.sanitize!.data = createData;

            mockCreateRouteGuard.mockResolvedValue(
                createdRouteGuard,
            );

            await invoke("create");

            expect(mockCreateRouteGuard)
                .toHaveBeenCalledTimes(1);

            expect(mockCreateRouteGuard)
                .toHaveBeenCalledWith(createData);

            expectJsonResponse(200, {
                id: 42,
            });
        });

        it("should pass the exact sanitized data to the service", async () => {
            const createData: CreateRouteGuardDTO = {
                role_id: 25,
                route: "/api/reports",
            };

            req.sanitize!.data = createData;

            mockCreateRouteGuard.mockResolvedValue({
                id: 99,
                ...createData,
                created_at: new Date(),
                updated_at: new Date(),
            });

            await invoke("create");

            expect(mockCreateRouteGuard)
                .toHaveBeenCalledTimes(1);

            expect(mockCreateRouteGuard)
                .toHaveBeenCalledWith(createData);

            expectJsonResponse(200, {
                id: 99,
            });
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to create route guard",
            );

            mockCreateRouteGuard.mockRejectedValue(
                serviceError,
            );

            await invoke("create");

            expect(mockCreateRouteGuard)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("create");

            expect(mockCreateRouteGuard)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("browse()", () => {
        const browseResult: RouteGuardRow[] = [
            routeGuard,
        ];

        beforeEach(() => {
            req.app = {
                get: vi.fn().mockReturnValue({
                    page: 1,
                    perPage: 20,
                }),
            } as any;

            req.sanitize!.query.numeric
                .mockReturnValue(null);
        });

        it("should browse route guards using pagination", async () => {
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            const expectedFilters: BrowseRouteGuardQuery = {
                page: 1,
                perPage: 20,
            };

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledTimes(1);

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith(
                    expectedFilters,
                );

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should include role_id when provided", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        if (key === "role_id") {
                            return "10";
                        }

                        return null;
                    },
                );

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(
                req.sanitize!.query.get,
            ).toHaveBeenCalledWith("role_id");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                    role_id: 10,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should omit role_id when the parameter is absent", async () => {
            /*
             * Regression test: an absent `role_id` used to become
             * `role_id = 0`, which returned an empty page.
             */
            req.sanitize!.query.get
                .mockReturnValue(undefined);

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should use the requested page and perPage", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 3,
                    perPage: 50,
                });

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 3,
                    perPage: 50,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should clamp page to a minimum of 1", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 0,
                    perPage: 20,
                });

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should clamp negative page to 1", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: -10,
                    perPage: 20,
                });

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should clamp perPage to a minimum of 1", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 1,
                    perPage: 0,
                });

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 1,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should cap perPage at 100", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 1,
                    perPage: 500,
                });

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 100,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should default page to 1 when pagination page is missing", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    perPage: 25,
                });

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 25,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should default perPage to 20 when pagination perPage is missing", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 2,
                });

            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                    page: 2,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to browse route guards",
            );

            mockBrowseRouteGuards
                .mockRejectedValue(serviceError);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize query context is missing", async () => {
            delete req.sanitize;

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });

        it("should forward an error when app context is missing", async () => {
            req.app = undefined;

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });

        it("should forward an error when pagination context is missing", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue(undefined);

            await invoke("browse");

            expect(mockBrowseRouteGuards)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("view()", () => {
        it("should find a route guard using the numeric route ID", async () => {
            req.params = {
                id: "42",
            };

            const result: RouteGuardRow = {
                ...routeGuard,
                id: 42,
            };

            mockFindById
                .mockResolvedValue(result);

            await invoke("view");

            expect(mockFindById)
                .toHaveBeenCalledTimes(1);

            expect(mockFindById)
                .toHaveBeenCalledWith(42);

            expectJsonResponse(
                200,
                result,
            );
        });

        it("should convert the route ID from string to number", async () => {
            req.params = {
                id: "123",
            };

            const result: RouteGuardRow = {
                ...routeGuard,
                id: 123,
            };

            mockFindById
                .mockResolvedValue(result);

            await invoke("view");

            expect(mockFindById)
                .toHaveBeenCalledTimes(1);

            expect(mockFindById)
                .toHaveBeenCalledWith(123);

            expectJsonResponse(
                200,
                result,
            );
        });

        it.each([
            "0",
            "-1",
            "abc",
            "1.5",
            "",
        ])(
            "should forward an AppError for invalid id: %s",
            async (invalidId) => {
                req.params = {
                    id: invalidId,
                };

                await invoke("view");

                expect(mockFindById)
                    .not.toHaveBeenCalled();

                expect(next)
                    .toHaveBeenCalledTimes(1);

                const error = (
                    next as ReturnType<typeof vi.fn>
                ).mock.calls[0][0];

                expect(error)
                    .toBeInstanceOf(AppError);

                expect(res.status)
                    .not.toHaveBeenCalled();

                expect(res.json)
                    .not.toHaveBeenCalled();

                expect(res.send)
                    .not.toHaveBeenCalled();
            },
        );

        it("should accept scientific notation that resolves to a safe positive integer", async () => {
            req.params = {
                id: "1e3",
            };

            const result: RouteGuardRow = {
                ...routeGuard,
                id: 1000,
            };

            mockFindById
                .mockResolvedValue(result);

            await invoke("view");

            expect(mockFindById)
                .toHaveBeenCalledTimes(1);

            expect(mockFindById)
                .toHaveBeenCalledWith(1000);

            expectJsonResponse(
                200,
                result,
            );
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Route guard not found",
            );

            mockFindById
                .mockRejectedValue(serviceError);

            await invoke("view");

            expect(mockFindById)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when route params are missing", async () => {
            req.params = undefined;

            await invoke("view");

            expect(mockFindById)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("delete()", () => {
        it("should hard delete a route guard using the numeric route ID", async () => {
            req.params = {
                id: "42",
            };

            mockHardDelete
                .mockResolvedValue(undefined);

            await invoke("delete");

            expect(mockHardDelete)
                .toHaveBeenCalledTimes(1);

            expect(mockHardDelete)
                .toHaveBeenCalledWith(42);

            expectSendResponse(200);
        });

        it("should convert the route ID from string to number", async () => {
            req.params = {
                id: "99",
            };

            mockHardDelete
                .mockResolvedValue(undefined);

            await invoke("delete");

            expect(mockHardDelete)
                .toHaveBeenCalledTimes(1);

            expect(mockHardDelete)
                .toHaveBeenCalledWith(99);

            expectSendResponse(200);
        });

        it.each([
            "0",
            "-1",
            "abc",
            "1.5",
            "",
        ])(
            "should forward an AppError for invalid id: %s",
            async (invalidId) => {
                req.params = {
                    id: invalidId,
                };

                await invoke("delete");

                expect(mockHardDelete)
                    .not.toHaveBeenCalled();

                expect(next)
                    .toHaveBeenCalledTimes(1);

                const error = (
                    next as ReturnType<typeof vi.fn>
                ).mock.calls[0][0];

                expect(error)
                    .toBeInstanceOf(AppError);

                expect(res.status)
                    .not.toHaveBeenCalled();

                expect(res.json)
                    .not.toHaveBeenCalled();

                expect(res.send)
                    .not.toHaveBeenCalled();
            },
        );

        it("should accept scientific notation that resolves to a safe positive integer", async () => {
            req.params = {
                id: "1e3",
            };

            mockHardDelete
                .mockResolvedValue(undefined);

            await invoke("delete");

            expect(mockHardDelete)
                .toHaveBeenCalledTimes(1);

            expect(mockHardDelete)
                .toHaveBeenCalledWith(1000);

            expectSendResponse(200);
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to delete route guard",
            );

            mockHardDelete
                .mockRejectedValue(serviceError);

            await invoke("delete");

            expect(mockHardDelete)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when route params are missing", async () => {
            req.params = undefined;

            await invoke("delete");

            expect(mockHardDelete)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });
});
