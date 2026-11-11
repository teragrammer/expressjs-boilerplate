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
// __test__/modules/users/controllers/user.controller.spec.ts
const vitest_1 = require("vitest");
const user_controller_1 = require("./user.controller");
const { mockCreateUser, mockUpdateUser, mockBrowseUsers, mockFindById, mockSoftDelete, } = vitest_1.vi.hoisted(() => ({
    mockCreateUser: vitest_1.vi.fn(),
    mockUpdateUser: vitest_1.vi.fn(),
    mockBrowseUsers: vitest_1.vi.fn(),
    mockFindById: vitest_1.vi.fn(),
    mockSoftDelete: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
}));
(0, vitest_1.describe)("UserController", () => {
    let controller;
    let req;
    let res;
    let next;
    const user = {
        id: 1,
        first_name: "John",
        middle_name: null,
        last_name: "Doe",
        gender: null,
        address: "123 Main Street",
        phone: "+1234567890",
        is_phone_verified: true,
        email: "john@example.com",
        is_email_verified: true,
        has_tfa: false,
        tfa_secret: null,
        role_id: 1,
        username: "johndoe",
        password: "$2b$10$hashed-password",
        status: "Activated",
        login_tries: 0,
        failed_login_expired_at: null,
        comments: null,
        authorization_version: 0,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
    };
    const invoke = (method) => __awaiter(void 0, void 0, void 0, function* () {
        yield controller[method](req, res, next);
    });
    const expectResponse = (type, data) => {
        (0, vitest_1.expect)(res.status).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(res.status).toHaveBeenCalledWith(200);
        if (type === "json") {
            (0, vitest_1.expect)(res.json).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(res.json).toHaveBeenCalledWith(data);
            (0, vitest_1.expect)(res.send).not.toHaveBeenCalled();
        }
        else {
            (0, vitest_1.expect)(res.send).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(res.send).toHaveBeenCalledWith();
            (0, vitest_1.expect)(res.json).not.toHaveBeenCalled();
        }
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
        vitest_1.vi.clearAllMocks();
        const userService = {
            createUser: mockCreateUser,
            updateUser: mockUpdateUser,
            browseUsers: mockBrowseUsers,
            findById: mockFindById,
            softDelete: mockSoftDelete,
        };
        controller = new user_controller_1.UserController(userService);
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
                    first_name: "John",
                    middle_name: "Michael",
                    last_name: "Doe",
                    email: "john@example.com",
                    username: "johndoe",
                    role_id: 1,
                    password: "Password123!",
                },
            },
            cursorPagination: {
                cursor: undefined,
                perPage: 20,
            },
        };
    });
    (0, vitest_1.describe)("create()", () => {
        (0, vitest_1.it)("should create a user and return the created user ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                first_name: "John",
                middle_name: "Michael",
                last_name: "Doe",
                email: "john@example.com",
                username: "johndoe",
                role_id: 1,
                password: "Password123!",
            };
            const createdUser = Object.assign(Object.assign({}, user), { id: 42 });
            req.sanitize.data = createData;
            mockCreateUser.mockResolvedValue(createdUser);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateUser).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateUser).toHaveBeenCalledWith(createData);
            expectResponse("json", {
                id: 42,
            });
        }));
        (0, vitest_1.it)("should pass the exact sanitized data to the service", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                first_name: "Jane",
                last_name: "Smith",
                email: "jane@example.com",
                username: "janesmith",
                role_id: 2,
                password: null,
            };
            const createdUser = Object.assign(Object.assign({}, user), { id: 99 });
            req.sanitize.data = createData;
            mockCreateUser.mockResolvedValue(createdUser);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateUser).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateUser).toHaveBeenCalledWith(createData);
            expectResponse("json", {
                id: 99,
            });
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to create user");
            mockCreateUser.mockRejectedValue(serviceError);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateUser).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateUser).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("update()", () => {
        (0, vitest_1.it)("should update a user using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const updateData = {
                first_name: "John",
                last_name: "Updated",
                address: "456 New Street",
            };
            req.params = {
                id: "42",
            };
            req.sanitize.data = updateData;
            mockUpdateUser.mockResolvedValue(Object.assign(Object.assign({}, user), { id: 42, last_name: "Updated" }));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateUser).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateUser).toHaveBeenCalledWith(42, updateData);
            expectResponse("send");
        }));
        (0, vitest_1.it)("should convert a string route ID to a number", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "123",
            };
            req.sanitize.data = {
                first_name: "Jane",
            };
            mockUpdateUser.mockResolvedValue(Object.assign(Object.assign({}, user), { id: 123 }));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateUser).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateUser).toHaveBeenCalledWith(123, req.sanitize.data);
            expectResponse("send");
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to update user");
            mockUpdateUser.mockRejectedValue(serviceError);
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateUser).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when route params are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = undefined;
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateUser).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateUser).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("browse()", () => {
        const browseResult = {
            data: [user],
            hasMore: false,
            nextCursor: null,
        };
        (0, vitest_1.it)("should browse users using sanitized filters and cursor pagination", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.numeric.mockReturnValue(2);
            req.sanitize.query.get.mockImplementation((key) => {
                const values = {
                    status: "Activated",
                    search: "john",
                };
                return values[key];
            });
            req.cursorPagination = {
                cursor: 481,
                perPage: 20,
            };
            mockBrowseUsers.mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseUsers).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseUsers).toHaveBeenCalledWith({
                role_id: 2,
                status: "Activated",
                search: "john",
                cursor: 481,
                limit: 20,
            });
            expectResponse("json", browseResult);
        }));
        (0, vitest_1.it)("should use undefined filters when sanitized query values are empty", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.numeric.mockReturnValue(undefined);
            req.sanitize.query.get.mockReturnValue(undefined);
            req.cursorPagination = {
                cursor: undefined,
                perPage: 20,
            };
            mockBrowseUsers.mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseUsers).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseUsers).toHaveBeenCalledWith({
                role_id: undefined,
                status: undefined,
                search: undefined,
                cursor: undefined,
                limit: 20,
            });
            expectResponse("json", browseResult);
        }));
        (0, vitest_1.it)("should preserve the cursor returned by pagination middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.numeric.mockReturnValue(3);
            req.sanitize.query.get.mockImplementation((key) => {
                if (key === "status") {
                    return "Activated";
                }
                if (key === "search") {
                    return "john";
                }
                return undefined;
            });
            req.cursorPagination = {
                cursor: 100,
                perPage: 10,
            };
            mockBrowseUsers.mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseUsers).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseUsers).toHaveBeenCalledWith({
                role_id: 3,
                status: "Activated",
                search: "john",
                cursor: 100,
                limit: 10,
            });
            expectResponse("json", browseResult);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to browse users");
            mockBrowseUsers.mockRejectedValue(serviceError);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseUsers).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize query context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseUsers).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when cursor pagination context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.cursorPagination;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseUsers).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("view()", () => {
        (0, vitest_1.it)("should find a user using the numeric route ID and return the user", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "42",
            };
            const result = Object.assign(Object.assign({}, user), { id: 42 });
            mockFindById.mockResolvedValue(result);
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockFindById).toHaveBeenCalledWith(42);
            expectResponse("json", result);
        }));
        (0, vitest_1.it)("should convert the route ID from string to number", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "123",
            };
            const result = Object.assign(Object.assign({}, user), { id: 123 });
            mockFindById.mockResolvedValue(result);
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockFindById).toHaveBeenCalledWith(123);
            expectResponse("json", result);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("User not found");
            mockFindById.mockRejectedValue(serviceError);
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when route params are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = undefined;
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("delete()", () => {
        (0, vitest_1.it)("should soft delete a user using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "42",
            };
            mockSoftDelete.mockResolvedValue(undefined);
            yield invoke("delete");
            (0, vitest_1.expect)(mockSoftDelete).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockSoftDelete).toHaveBeenCalledWith(42);
            expectResponse("send");
        }));
        (0, vitest_1.it)("should convert the route ID from string to number", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "99",
            };
            mockSoftDelete.mockResolvedValue(undefined);
            yield invoke("delete");
            (0, vitest_1.expect)(mockSoftDelete).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockSoftDelete).toHaveBeenCalledWith(99);
            expectResponse("send");
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to delete user");
            mockSoftDelete.mockRejectedValue(serviceError);
            yield invoke("delete");
            (0, vitest_1.expect)(mockSoftDelete).toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when route params are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = undefined;
            yield invoke("delete");
            (0, vitest_1.expect)(mockSoftDelete).not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
});
