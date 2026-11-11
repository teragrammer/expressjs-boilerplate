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
const role_controller_1 = require("./role.controller");
const errors_1 = require("../../../common/utils/errors");
const { mockCreateRole, mockUpdateRole, mockBrowseRoles, mockFindById, mockHardDelete, } = vitest_1.vi.hoisted(() => ({
    mockCreateRole: vitest_1.vi.fn(),
    mockUpdateRole: vitest_1.vi.fn(),
    mockBrowseRoles: vitest_1.vi.fn(),
    mockFindById: vitest_1.vi.fn(),
    mockHardDelete: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
}));
(0, vitest_1.describe)("RoleController", () => {
    let controller;
    let req;
    let res;
    let next;
    const role = {
        id: 1,
        name: "Administrator",
        slug: "administrator",
        description: "Full system administrator role",
        is_public: false,
        is_bypass_authorization: true,
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
        const roleService = {
            createRole: mockCreateRole,
            updateRole: mockUpdateRole,
            browseRoles: mockBrowseRoles,
            findById: mockFindById,
            hardDelete: mockHardDelete,
        };
        controller = new role_controller_1.RoleController(roleService);
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
                    name: "Administrator",
                    slug: "administrator",
                    description: "Full system administrator role",
                    is_public: false,
                    is_bypass_authorization: true,
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
        (0, vitest_1.it)("should create a role and return the created role ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                name: "Administrator",
                slug: "administrator",
                description: "Full system administrator role",
                is_public: false,
                is_bypass_authorization: true,
            };
            const createdRole = Object.assign(Object.assign({}, role), { id: 42 });
            req.sanitize.data = createData;
            mockCreateRole.mockResolvedValue(createdRole);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRole)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateRole)
                .toHaveBeenCalledWith(createData);
            expectJsonResponse(201, {
                id: 42,
            });
        }));
        (0, vitest_1.it)("should pass the exact sanitized data to the service", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                name: "Public User",
                slug: "public-user",
                description: "Publicly accessible role",
                is_public: true,
                is_bypass_authorization: false,
            };
            req.sanitize.data = createData;
            mockCreateRole.mockResolvedValue(Object.assign(Object.assign(Object.assign({}, role), { id: 99 }), createData));
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRole)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateRole)
                .toHaveBeenCalledWith(createData);
            expectJsonResponse(201, {
                id: 99,
            });
        }));
        (0, vitest_1.it)("should support optional role fields being omitted", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                name: "Basic User",
                slug: "basic-user",
            };
            req.sanitize.data = createData;
            mockCreateRole.mockResolvedValue(Object.assign(Object.assign({}, role), { id: 100, name: createData.name, slug: createData.slug }));
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRole)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateRole)
                .toHaveBeenCalledWith(createData);
            expectJsonResponse(201, {
                id: 100,
            });
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to create role");
            mockCreateRole.mockRejectedValue(serviceError);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRole)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateRole)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("update()", () => {
        (0, vitest_1.it)("should update a role using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const updateData = {
                name: "Super Administrator",
                description: "Updated administrator role",
            };
            req.params = {
                id: "42",
            };
            req.sanitize.data = updateData;
            mockUpdateRole.mockResolvedValue(Object.assign(Object.assign(Object.assign({}, role), { id: 42 }), updateData));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateRole)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateRole)
                .toHaveBeenCalledWith(42, updateData);
            expectJsonResponse(200, {
                id: 42,
            });
        }));
        (0, vitest_1.it)("should convert a string route ID to a number", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "123",
            };
            req.sanitize.data = {
                name: "Test Role",
            };
            mockUpdateRole.mockResolvedValue(Object.assign(Object.assign({}, role), { id: 123 }));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateRole)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateRole)
                .toHaveBeenCalledWith(123, req.sanitize.data);
            expectJsonResponse(200, {
                id: 123,
            });
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
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateRole)
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
            req.sanitize.data = {
                name: "Administrator",
            };
            mockUpdateRole.mockResolvedValue(Object.assign(Object.assign({}, role), { id: 1000 }));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateRole)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateRole)
                .toHaveBeenCalledWith(1000, req.sanitize.data);
            expectJsonResponse(200, {
                id: 1000,
            });
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to update role");
            mockUpdateRole.mockRejectedValue(serviceError);
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateRole)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when route params are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = undefined;
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateRole)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateRole)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("browse()", () => {
        const browseResult = [
            role,
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
            req.sanitize.query.get
                .mockReturnValue(null);
        });
        (0, vitest_1.it)("should browse roles using sanitized filters and pagination", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => {
                var _a;
                const values = {
                    search: "  administrator  ",
                    is_public: "1",
                };
                return (_a = values[key]) !== null && _a !== void 0 ? _a : null;
            });
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 2,
                perPage: 25,
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            const expectedFilters = {
                page: 2,
                perPage: 25,
                is_public: true,
                search: "administrator",
            };
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith(expectedFilters);
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should omit optional filters when sanitized values are null", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.numeric
                .mockReturnValue(null);
            req.sanitize.query.get
                .mockReturnValue(null);
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 1,
                perPage: 20,
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should convert the is_public filter to boolean true", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => {
                if (key === "is_public") {
                    return "1";
                }
                return null;
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
                is_public: true,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should convert the is_public filter to boolean false", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => {
                if (key === "is_public") {
                    return "0";
                }
                return null;
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
                is_public: false,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should trim the search filter before passing it to the service", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.numeric
                .mockReturnValue(null);
            req.sanitize.query.get
                .mockImplementation((key) => {
                if (key === "search") {
                    return "   admin role   ";
                }
                return null;
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
                search: "admin role",
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should drop a blank search string instead of filtering on it", () => __awaiter(void 0, void 0, void 0, function* () {
            /*
             * Regression test: a blank search used to become
             * `search: ""`, which produced a `LIKE '%%'` predicate.
             */
            req.sanitize.query.get
                .mockImplementation((key) => {
                if (key === "search") {
                    return "   ";
                }
                return null;
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should not apply a filter when the parameter is absent", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockReturnValue(undefined);
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should reject an invalid is_public filter", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => key === "is_public" ? "maybe" : null);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.objectContaining({
                statusCode: 400,
            }));
        }));
        (0, vitest_1.it)("should clamp pagination to the controller limits", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 0,
                perPage: 500,
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 100,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should default pagination when pagination values are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({});
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should clamp a negative page to 1", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: -10,
                perPage: 20,
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should clamp perPage below 1 to 1", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 1,
                perPage: 0,
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
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
                perPage: 1000,
            });
            mockBrowseRoles
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 100,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to browse roles");
            mockBrowseRoles
                .mockRejectedValue(serviceError);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize query context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when app pagination context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app = undefined;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when app pagination getter returns undefined", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue(undefined);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseRoles)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("view()", () => {
        (0, vitest_1.it)("should find a role using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "42",
            };
            const result = Object.assign(Object.assign({}, role), { id: 42 });
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
            const result = Object.assign(Object.assign({}, role), { id: 123 });
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
            const result = Object.assign(Object.assign({}, role), { id: 1000 });
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
            const serviceError = new Error("Role not found");
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
        (0, vitest_1.it)("should hard delete a role using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
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
            const serviceError = new Error("Failed to delete role");
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
