// __test__/modules/users/controllers/user.controller.spec.ts
import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {UserController} from "./user.controller";
import {UserService} from "../services/user.service";
import {UserPurgeService} from "../services/user-purge.service";
import {AuditService} from "../../audit/audit.service";
import {BrowseUsersResult, CreateUserDTO, UpdateUserDTO, User,} from "../user.interface";

const {
    mockCreateUser,
    mockUpdateUser,
    mockBrowseUsers,
    mockFindById,
    mockSoftDelete,
    mockPurge,
    mockAuditSuccess,
    mockAuditFailure,
} = vi.hoisted(() => ({
    mockCreateUser: vi.fn(),
    mockUpdateUser: vi.fn(),
    mockBrowseUsers: vi.fn(),
    mockFindById: vi.fn(),
    mockSoftDelete: vi.fn(),
    mockPurge: vi.fn(),
    mockAuditSuccess: vi.fn(),
    mockAuditFailure: vi.fn(),
}));

vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn: any) => (req: any, res: any, next: any) =>
        Promise.resolve(fn(req, res, next)).catch(next),
}));

describe("UserController", () => {
    let controller: UserController;

    let req: Partial<Request> & {
        sanitize?: any;
        cursorPagination?: any;
    };

    let res: Partial<Response>;
    let next: NextFunction;

    const user: User = {
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

    const invoke = async (
        method: "create" | "update" | "browse" | "view" | "delete",
    ) => {
        await controller[method](
            req as Request,
            res as Response,
            next,
        );
    };

    const expectResponse = (
        type: "json" | "send",
        data?: unknown,
    ) => {
        expect(res.status).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);

        if (type === "json") {
            expect(res.json).toHaveBeenCalledTimes(1);
            expect(res.json).toHaveBeenCalledWith(data);
            expect(res.send).not.toHaveBeenCalled();
        } else {
            expect(res.send).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledWith();
            expect(res.json).not.toHaveBeenCalled();
        }

        expect(next).not.toHaveBeenCalled();
    };

    const expectErrorForwarded = (error: unknown) => {
        expect(next).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledWith(error);

        expect(res.status).not.toHaveBeenCalled();
        expect(res.json).not.toHaveBeenCalled();
        expect(res.send).not.toHaveBeenCalled();
    };

    beforeEach(() => {
        vi.clearAllMocks();

        const userService = {
            createUser: mockCreateUser,
            updateUser: mockUpdateUser,
            browseUsers: mockBrowseUsers,
            findById: mockFindById,
            softDelete: mockSoftDelete,
        } as unknown as UserService;

        const userPurgeService = {
            purge: mockPurge,
        } as unknown as UserPurgeService;

        const auditService = {
            success: mockAuditSuccess,
            failure: mockAuditFailure,
        } as unknown as AuditService;

        controller = new UserController(
            userService,
            userPurgeService,
            auditService,
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

            /*
             * The controller resolves the authorization actor from the
             * request credentials.
             */
            credentials: {
                jwt: {
                    uid: 1,
                    tid: 1,
                    tfa: true,
                    rol: "admin",
                    bpa: 1,
                },
                user: vi.fn(),
                authentication: vi.fn(),
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

    describe("create()", () => {
        it("should create a user and return the created user ID", async () => {
            const createData: CreateUserDTO = {
                first_name: "John",
                middle_name: "Michael",
                last_name: "Doe",
                email: "john@example.com",
                username: "johndoe",
                role_id: 1,
                password: "Password123!",
            };

            const createdUser = {
                ...user,
                id: 42,
            };

            req.sanitize!.data = createData;
            mockCreateUser.mockResolvedValue(createdUser);

            await invoke("create");

            expect(mockCreateUser).toHaveBeenCalledTimes(1);
            expect(mockCreateUser).toHaveBeenCalledWith(
                createData,
                expect.objectContaining({roleSlug: "admin"}),
            );

            expectResponse("json", {
                id: 42,
            });
        });

        it("should pass the exact sanitized data to the service", async () => {
            const createData: CreateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
                email: "jane@example.com",
                username: "janesmith",
                role_id: 2,
                password: null,
            };

            const createdUser = {
                ...user,
                id: 99,
            };

            req.sanitize!.data = createData;
            mockCreateUser.mockResolvedValue(createdUser);

            await invoke("create");

            expect(mockCreateUser).toHaveBeenCalledTimes(1);
            expect(mockCreateUser).toHaveBeenCalledWith(
                createData,
                expect.objectContaining({roleSlug: "admin"}),
            );

            expectResponse("json", {
                id: 99,
            });
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to create user",
            );

            mockCreateUser.mockRejectedValue(serviceError);

            await invoke("create");

            expect(mockCreateUser).toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("create");

            expect(mockCreateUser).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });
    });

    describe("update()", () => {
        it("should update a user using the numeric route ID", async () => {
            const updateData: UpdateUserDTO = {
                first_name: "John",
                last_name: "Updated",
                address: "456 New Street",
            };

            req.params = {
                id: "42",
            };

            req.sanitize!.data = updateData;

            mockUpdateUser.mockResolvedValue({
                ...user,
                id: 42,
                last_name: "Updated",
            });

            await invoke("update");

            expect(mockUpdateUser).toHaveBeenCalledTimes(1);
            expect(mockUpdateUser).toHaveBeenCalledWith(
                42,
                updateData,
                expect.objectContaining({roleSlug: "admin"}),
            );

            expectResponse("send");
        });

        it("should convert a string route ID to a number", async () => {
            req.params = {
                id: "123",
            };

            req.sanitize!.data = {
                first_name: "Jane",
            };

            mockUpdateUser.mockResolvedValue({
                ...user,
                id: 123,
            });

            await invoke("update");

            expect(mockUpdateUser).toHaveBeenCalledTimes(1);
            expect(mockUpdateUser).toHaveBeenCalledWith(
                123,
                req.sanitize!.data,
                expect.objectContaining({roleSlug: "admin"}),
            );

            expectResponse("send");
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to update user",
            );

            mockUpdateUser.mockRejectedValue(serviceError);

            await invoke("update");

            expect(mockUpdateUser).toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when route params are missing", async () => {
            req.params = undefined;

            await invoke("update");

            expect(mockUpdateUser).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("update");

            expect(mockUpdateUser).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });
    });

    describe("browse()", () => {
        const browseResult: BrowseUsersResult = {
            data: [user],
            hasMore: false,
            nextCursor: null,
        };

        it("should browse users using sanitized filters and cursor pagination", async () => {
            req.sanitize!.query.numeric.mockReturnValue(2);

            req.sanitize!.query.get.mockImplementation(
                (key: string) => {
                    const values: Record<string, string> = {
                        status: "Activated",
                        search: "john",
                    };

                    return values[key];
                },
            );

            req.cursorPagination = {
                cursor: 481,
                perPage: 20,
            };

            mockBrowseUsers.mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseUsers).toHaveBeenCalledTimes(1);
            expect(mockBrowseUsers).toHaveBeenCalledWith({
                role_id: 2,
                status: "Activated",
                search: "john",
                cursor: 481,
                limit: 20,
            });

            expectResponse("json", browseResult);
        });

        it("should use undefined filters when sanitized query values are empty", async () => {
            req.sanitize!.query.numeric.mockReturnValue(undefined);
            req.sanitize!.query.get.mockReturnValue(undefined);

            req.cursorPagination = {
                cursor: undefined,
                perPage: 20,
            };

            mockBrowseUsers.mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseUsers).toHaveBeenCalledTimes(1);
            expect(mockBrowseUsers).toHaveBeenCalledWith({
                role_id: undefined,
                status: undefined,
                search: undefined,
                cursor: undefined,
                limit: 20,
            });

            expectResponse("json", browseResult);
        });

        it("should preserve the cursor returned by pagination middleware", async () => {
            req.sanitize!.query.numeric.mockReturnValue(3);

            req.sanitize!.query.get.mockImplementation(
                (key: string) => {
                    if (key === "status") {
                        return "Activated";
                    }

                    if (key === "search") {
                        return "john";
                    }

                    return undefined;
                },
            );

            req.cursorPagination = {
                cursor: 100,
                perPage: 10,
            };

            mockBrowseUsers.mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseUsers).toHaveBeenCalledTimes(1);
            expect(mockBrowseUsers).toHaveBeenCalledWith({
                role_id: 3,
                status: "Activated",
                search: "john",
                cursor: 100,
                limit: 10,
            });

            expectResponse("json", browseResult);
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to browse users",
            );

            mockBrowseUsers.mockRejectedValue(serviceError);

            await invoke("browse");

            expect(mockBrowseUsers).toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize query context is missing", async () => {
            delete req.sanitize;

            await invoke("browse");

            expect(mockBrowseUsers).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });

        it("should forward an error when cursor pagination context is missing", async () => {
            delete req.cursorPagination;

            await invoke("browse");

            expect(mockBrowseUsers).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });
    });

    describe("view()", () => {
        it("should find a user using the numeric route ID and return the user", async () => {
            req.params = {
                id: "42",
            };

            const result = {
                ...user,
                id: 42,
            };

            mockFindById.mockResolvedValue(result);

            await invoke("view");

            expect(mockFindById).toHaveBeenCalledTimes(1);
            expect(mockFindById).toHaveBeenCalledWith(
                42,
                expect.objectContaining({roleSlug: "admin"}),
            );

            expectResponse("json", result);
        });

        it("should convert the route ID from string to number", async () => {
            req.params = {
                id: "123",
            };

            const result = {
                ...user,
                id: 123,
            };

            mockFindById.mockResolvedValue(result);

            await invoke("view");

            expect(mockFindById).toHaveBeenCalledTimes(1);
            expect(mockFindById).toHaveBeenCalledWith(
                123,
                expect.objectContaining({roleSlug: "admin"}),
            );

            expectResponse("json", result);
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "User not found",
            );

            mockFindById.mockRejectedValue(serviceError);

            await invoke("view");

            expect(mockFindById).toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when route params are missing", async () => {
            req.params = undefined;

            await invoke("view");

            expect(mockFindById).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });
    });

    describe("delete()", () => {
        it("should soft delete a user using the numeric route ID", async () => {
            req.params = {
                id: "42",
            };

            mockSoftDelete.mockResolvedValue(undefined);

            await invoke("delete");

            expect(mockSoftDelete).toHaveBeenCalledTimes(1);
            expect(mockSoftDelete).toHaveBeenCalledWith(42);

            expectResponse("send");
        });

        it("should convert the route ID from string to number", async () => {
            req.params = {
                id: "99",
            };

            mockSoftDelete.mockResolvedValue(undefined);

            await invoke("delete");

            expect(mockSoftDelete).toHaveBeenCalledTimes(1);
            expect(mockSoftDelete).toHaveBeenCalledWith(99);

            expectResponse("send");
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to delete user",
            );

            mockSoftDelete.mockRejectedValue(serviceError);

            await invoke("delete");

            expect(mockSoftDelete).toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when route params are missing", async () => {
            req.params = undefined;

            await invoke("delete");

            expect(mockSoftDelete).not.toHaveBeenCalled();

            expectErrorForwarded(expect.any(TypeError));
        });
    });
});