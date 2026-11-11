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
// __test__/modules/system/controllers/route-guard.controller.spec.ts
const vitest_1 = require("vitest");
const route_guard_controller_1 = require("./route-guard.controller");
const errors_1 = require("../../../common/utils/errors");
const { mockCreateRouteGuard, mockBrowseRouteGuards, mockFindById, mockHardDelete, } = vitest_1.vi.hoisted(() => ({
    mockCreateRouteGuard: vitest_1.vi.fn(),
    mockBrowseRouteGuards: vitest_1.vi.fn(),
    mockFindById: vitest_1.vi.fn(),
    mockHardDelete: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
}));
(0, vitest_1.describe)("RouteGuardController", () => {
    let controller;
    let req;
    let res;
    let next;
    const routeGuard = {
        id: 1,
        role_id: 10,
        route: "/admin/users",
        role_slug: "administrator",
        created_at: new Date(),
        updated_at: new Date(),
    };
    const invoke = (method) => __awaiter(void 0, void 0, void 0, function* () {
        yield controller[method](req, res, next);
    });
    const expectJsonResponse = (statusCode, data) => {
        (0, vitest_1.expect)(res.status).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(statusCode);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.json).toHaveBeenCalledWith(data);
        (0, vitest_1.expect)(res.send).not.toHaveBeenCalled();
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    };
    const expectSendResponse = (statusCode) => {
        (0, vitest_1.expect)(res.status).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(statusCode);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.send).toHaveBeenCalledWith();
        (0, vitest_1.expect)(res.json).not.toHaveBeenCalled();
        (0, vitest_1.expect)(next).not.toHaveBeenCalled();
    };
    const expectErrorForwarded = (error) => {
        (0, vitest_1.expect)(next).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(next).toHaveBeenCalledWith(error);
        (0, vitest_1.expect)(res.status).not.toHaveBeenCalled();
        (0, vitest_1.expect)(res.json).not.toHaveBeenCalled();
        (0, vitest_1.expect)(res.send).not.toHaveBeenCalled();
    };
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.resetAllMocks();
        const routeGuardService = {
            createRouteGuard: mockCreateRouteGuard,
            browseRouteGuards: mockBrowseRouteGuards,
            findById: mockFindById,
            hardDelete: mockHardDelete,
        };
        controller = new route_guard_controller_1.RouteGuardController(routeGuardService);
        res = {
            status: vitest_1.vi.fn().mockReturnThis(),
            json: vitest_1.vi.fn().mockReturnThis(),
            send: vitest_1.vi.fn().mockReturnThis(),
        };
        next = vitest_1.vi.fn();
        req = {
            params: {
                id: "1",
            },
            sanitize: {
                body: {
                    only: vitest_1.vi.fn(),
                    get: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                },
                query: {
                    only: vitest_1.vi.fn(),
                    get: vitest_1.vi.fn(),
                    numeric: vitest_1.vi.fn(),
                },
                data: {
                    role_id: 10,
                    route: "/admin/users",
                },
            },
            app: {
                get: vitest_1.vi.fn().mockReturnValue({
                    page: 1,
                    perPage: 20,
                }),
            },
        };
    });
    (0, vitest_1.describe)("create()", () => {
        (0, vitest_1.it)("should create a route guard and return the created route guard ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                role_id: 10,
                route: "/admin/users",
            };
            const createdRouteGuard = {
                id: 42,
                role_id: 10,
                route: "/admin/users",
                created_at: new Date(),
                updated_at: new Date(),
            };
            req.sanitize.data = createData;
            mockCreateRouteGuard.mockResolvedValue(createdRouteGuard);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRouteGuard)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateRouteGuard)
                .toHaveBeenCalledWith(createData);
            expectJsonResponse(200, {
                id: 42,
            });
        }));
        (0, vitest_1.it)("should pass the exact sanitized data to the service", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                role_id: 25,
                route: "/api/reports",
            };
            req.sanitize.data = createData;
            mockCreateRouteGuard.mockResolvedValue(Object.assign(Object.assign({ id: 99 }, createData), { created_at: new Date(), updated_at: new Date() }));
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRouteGuard)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateRouteGuard)
                .toHaveBeenCalledWith(createData);
            expectJsonResponse(200, {
                id: 99,
            });
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to create route guard");
            mockCreateRouteGuard.mockRejectedValue(serviceError);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRouteGuard)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRouteGuard)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("browse()", () => {
        const browseResult = [
            routeGuard,
        ];
        (0, vitest_1.beforeEach)(() => {
            req.app = {
                get: vitest_1.vi.fn().mockReturnValue({
                    page: 1,
                    perPage: 20,
                }),
            };
            req.sanitize.query.numeric
                .mockReturnValue(null);
        });
        (0, vitest_1.it)("should browse route guards using pagination", () => __awaiter(void 0, void 0, void 0, function* () {
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            const expectedFilters = {
                page: 1,
                perPage: 20,
            };
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith(expectedFilters);
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should include role_id when provided", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => {
                if (key === "role_id") {
                    return "10";
                }
                return null;
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(req.sanitize.query.get).toHaveBeenCalledWith("role_id");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
                role_id: 10,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should omit role_id when the parameter is absent", () => __awaiter(void 0, void 0, void 0, function* () {
            /*
             * Regression test: an absent `role_id` used to become
             * `role_id = 0`, which returned an empty page.
             */
            req.sanitize.query.get
                .mockReturnValue(undefined);
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should use the requested page and perPage", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 3,
                perPage: 50,
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 3,
                perPage: 50,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should clamp page to a minimum of 1", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 0,
                perPage: 20,
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should clamp negative page to 1", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: -10,
                perPage: 20,
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should clamp perPage to a minimum of 1", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 1,
                perPage: 0,
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 1,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should cap perPage at 100", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 1,
                perPage: 500,
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 100,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should default page to 1 when pagination page is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                perPage: 25,
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 25,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should default perPage to 20 when pagination perPage is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 2,
            });
            mockBrowseRouteGuards
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledWith({
                page: 2,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to browse route guards");
            mockBrowseRouteGuards
                .mockRejectedValue(serviceError);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize query context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when app context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app = undefined;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when pagination context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue(undefined);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRouteGuards)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("view()", () => {
        (0, vitest_1.it)("should find a route guard using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "42",
            };
            const result = Object.assign(Object.assign({}, routeGuard), { id: 42 });
            mockFindById
                .mockResolvedValue(result);
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledWith(42);
            expectJsonResponse(200, result);
        }));
        (0, vitest_1.it)("should convert the route ID from string to number", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "123",
            };
            const result = Object.assign(Object.assign({}, routeGuard), { id: 123 });
            mockFindById
                .mockResolvedValue(result);
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledWith(123);
            expectJsonResponse(200, result);
        }));
        vitest_1.it.each([
            "0",
            "-1",
            "abc",
            "1.5",
            "",
        ])("should forward an AppError for invalid id: %s", (invalidId) => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: invalidId,
            };
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(next)
                .toHaveBeenCalledTimes(1);
            const error = next.mock.calls[0][0];
            (0, vitest_1.expect)(error)
                .toBeInstanceOf(errors_1.AppError);
            (0, vitest_1.expect)(res.status)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.json)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.send)
                .not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should accept scientific notation that resolves to a safe positive integer", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "1e3",
            };
            const result = Object.assign(Object.assign({}, routeGuard), { id: 1000 });
            mockFindById
                .mockResolvedValue(result);
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledWith(1000);
            expectJsonResponse(200, result);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Route guard not found");
            mockFindById
                .mockRejectedValue(serviceError);
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when route params are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = undefined;
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("delete()", () => {
        (0, vitest_1.it)("should hard delete a route guard using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "42",
            };
            mockHardDelete
                .mockResolvedValue(undefined);
            yield invoke("delete");
            (0, vitest_1.expect)(mockHardDelete)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockHardDelete)
                .toHaveBeenCalledWith(42);
            expectSendResponse(200);
        }));
        (0, vitest_1.it)("should convert the route ID from string to number", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "99",
            };
            mockHardDelete
                .mockResolvedValue(undefined);
            yield invoke("delete");
            (0, vitest_1.expect)(mockHardDelete)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockHardDelete)
                .toHaveBeenCalledWith(99);
            expectSendResponse(200);
        }));
        vitest_1.it.each([
            "0",
            "-1",
            "abc",
            "1.5",
            "",
        ])("should forward an AppError for invalid id: %s", (invalidId) => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: invalidId,
            };
            yield invoke("delete");
            (0, vitest_1.expect)(mockHardDelete)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(next)
                .toHaveBeenCalledTimes(1);
            const error = next.mock.calls[0][0];
            (0, vitest_1.expect)(error)
                .toBeInstanceOf(errors_1.AppError);
            (0, vitest_1.expect)(res.status)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.json)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.send)
                .not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should accept scientific notation that resolves to a safe positive integer", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "1e3",
            };
            mockHardDelete
                .mockResolvedValue(undefined);
            yield invoke("delete");
            (0, vitest_1.expect)(mockHardDelete)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockHardDelete)
                .toHaveBeenCalledWith(1000);
            expectSendResponse(200);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to delete route guard");
            mockHardDelete
                .mockRejectedValue(serviceError);
            yield invoke("delete");
            (0, vitest_1.expect)(mockHardDelete)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when route params are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = undefined;
            yield invoke("delete");
            (0, vitest_1.expect)(mockHardDelete)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
});
