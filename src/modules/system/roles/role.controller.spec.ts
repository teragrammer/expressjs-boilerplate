import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextFunction, Request, Response} from "express";

import {RoleController} from "./role.controller";
import {RoleService} from "./role.service";
import {AuditService} from "../../audit/audit.service";
import {
    BrowseRoleQuery,
    CreateRoleDTO,
    Role,
    UpdateRoleDTO,
} from "./role.interface";
import {AppError} from "../../../common/utils/errors";

const {
    mockCreateRole,
    mockUpdateRole,
    mockBrowseRoles,
    mockFindById,
    mockHardDelete,
} = vi.hoisted(() => ({
    mockCreateRole: vi.fn(),
    mockUpdateRole: vi.fn(),
    mockBrowseRoles: vi.fn(),
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

describe("RoleController", () => {
    let controller: RoleController;

    let req: Partial<Request> & {
        sanitize?: any;
        params?: Record<string, string>;
    };

    let res: Partial<Response>;
    let next: NextFunction;

    const role: Role = {
        id: 1,
        name: "Administrator",
        slug: "administrator",
        description: "Full system administrator role",
        is_public: false,
        is_bypass_authorization: true,
        created_at: new Date(),
        updated_at: new Date(),
    };

    const invoke = async (
        method:
            | "create"
            | "update"
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

    let auditService: {
        success: ReturnType<typeof vi.fn>;
        failure: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.resetAllMocks();

        auditService = {
            success: vi.fn(),
            failure: vi.fn(),
        };

        const roleService = {
            createRole: mockCreateRole,
            updateRole: mockUpdateRole,
            browseRoles: mockBrowseRoles,
            findById: mockFindById,
            hardDelete: mockHardDelete,
        } as unknown as RoleService;

        controller = new RoleController(
            roleService,
            auditService as unknown as AuditService,
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
                    name: "Administrator",
                    slug: "administrator",
                    description: "Full system administrator role",
                    is_public: false,
                    is_bypass_authorization: true,
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
        it("should create a role and return the created role ID", async () => {
            const createData: CreateRoleDTO = {
                name: "Administrator",
                slug: "administrator",
                description: "Full system administrator role",
                is_public: false,
                is_bypass_authorization: true,
            };

            const createdRole: Role = {
                ...role,
                id: 42,
            };

            req.sanitize!.data = createData;

            mockCreateRole.mockResolvedValue(
                createdRole,
            );

            await invoke("create");

            expect(mockCreateRole)
                .toHaveBeenCalledTimes(1);

            expect(mockCreateRole)
                .toHaveBeenCalledWith(createData);

            expectJsonResponse(201, {
                id: 42,
            });
        });

        it("should pass the exact sanitized data to the service", async () => {
            const createData: CreateRoleDTO = {
                name: "Public User",
                slug: "public-user",
                description: "Publicly accessible role",
                is_public: true,
                is_bypass_authorization: false,
            };

            req.sanitize!.data = createData;

            mockCreateRole.mockResolvedValue({
                ...role,
                id: 99,
                ...createData,
            });

            await invoke("create");

            expect(mockCreateRole)
                .toHaveBeenCalledTimes(1);

            expect(mockCreateRole)
                .toHaveBeenCalledWith(createData);

            expectJsonResponse(201, {
                id: 99,
            });
        });

        it("should support optional role fields being omitted", async () => {
            const createData: CreateRoleDTO = {
                name: "Basic User",
                slug: "basic-user",
            };

            req.sanitize!.data = createData;

            mockCreateRole.mockResolvedValue({
                ...role,
                id: 100,
                name: createData.name,
                slug: createData.slug,
            });

            await invoke("create");

            expect(mockCreateRole)
                .toHaveBeenCalledTimes(1);

            expect(mockCreateRole)
                .toHaveBeenCalledWith(createData);

            expectJsonResponse(201, {
                id: 100,
            });
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to create role",
            );

            mockCreateRole.mockRejectedValue(
                serviceError,
            );

            await invoke("create");

            expect(mockCreateRole)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("create");

            expect(mockCreateRole)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("update()", () => {
        it("should update a role using the numeric route ID", async () => {
            const updateData: UpdateRoleDTO = {
                name: "Super Administrator",
                description: "Updated administrator role",
            };

            req.params = {
                id: "42",
            };

            req.sanitize!.data = updateData;

            mockUpdateRole.mockResolvedValue({
                ...role,
                id: 42,
                ...updateData,
            });

            await invoke("update");

            expect(mockUpdateRole)
                .toHaveBeenCalledTimes(1);

            expect(mockUpdateRole)
                .toHaveBeenCalledWith(
                    42,
                    updateData,
                );

            expectJsonResponse(200, {
                id: 42,
            });
        });

        it("should convert a string route ID to a number", async () => {
            req.params = {
                id: "123",
            };

            req.sanitize!.data = {
                name: "Test Role",
            };

            mockUpdateRole.mockResolvedValue({
                ...role,
                id: 123,
            });

            await invoke("update");

            expect(mockUpdateRole)
                .toHaveBeenCalledTimes(1);

            expect(mockUpdateRole)
                .toHaveBeenCalledWith(
                    123,
                    req.sanitize!.data,
                );

            expectJsonResponse(200, {
                id: 123,
            });
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

                await invoke("update");

                expect(mockUpdateRole)
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

            req.sanitize!.data = {
                name: "Administrator",
            };

            mockUpdateRole.mockResolvedValue({
                ...role,
                id: 1000,
            });

            await invoke("update");

            expect(mockUpdateRole)
                .toHaveBeenCalledTimes(1);

            expect(mockUpdateRole)
                .toHaveBeenCalledWith(
                    1000,
                    req.sanitize!.data,
                );

            expectJsonResponse(200, {
                id: 1000,
            });
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to update role",
            );

            mockUpdateRole.mockRejectedValue(
                serviceError,
            );

            await invoke("update");

            expect(mockUpdateRole)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when route params are missing", async () => {
            req.params = undefined;

            await invoke("update");

            expect(mockUpdateRole)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("update");

            expect(mockUpdateRole)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("browse()", () => {
        const browseResult: Role[] = [
            role,
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

            req.sanitize!.query.get
                .mockReturnValue(null);
        });

        it("should browse roles using sanitized filters and pagination", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        const values: Record<
                            string,
                            string | null
                        > = {
                            search: "  administrator  ",
                            is_public: "1",
                        };

                        return values[key] ?? null;
                    },
                );

            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 2,
                    perPage: 25,
                });

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            const expectedFilters: BrowseRoleQuery = {
                page: 2,
                perPage: 25,
                is_public: true,
                search: "administrator",
            };

            expect(mockBrowseRoles)
                .toHaveBeenCalledTimes(1);

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith(expectedFilters);

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should omit optional filters when sanitized values are null", async () => {
            req.sanitize!.query.numeric
                .mockReturnValue(null);

            req.sanitize!.query.get
                .mockReturnValue(null);

            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 1,
                    perPage: 20,
                });

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledTimes(1);

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should convert the is_public filter to boolean true", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        if (key === "is_public") {
                            return "1";
                        }

                        return null;
                    },
                );

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                    is_public: true,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should convert the is_public filter to boolean false", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        if (key === "is_public") {
                            return "0";
                        }

                        return null;
                    },
                );

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                    is_public: false,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should trim the search filter before passing it to the service", async () => {
            req.sanitize!.query.numeric
                .mockReturnValue(null);

            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        if (key === "search") {
                            return "   admin role   ";
                        }

                        return null;
                    },
                );

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                    search: "admin role",
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should drop a blank search string instead of filtering on it", async () => {
            /*
             * Regression test: a blank search used to become
             * `search: ""`, which produced a `LIKE '%%'` predicate.
             */
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        if (key === "search") {
                            return "   ";
                        }

                        return null;
                    },
                );

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should not apply a filter when the parameter is absent", async () => {
            req.sanitize!.query.get
                .mockReturnValue(undefined);

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });
        });

        it("should reject an invalid is_public filter", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) =>
                        key === "is_public" ? "maybe" : null,
                );

            await invoke("browse");

            expect(mockBrowseRoles)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.objectContaining({
                    statusCode: 400,
                }),
            );
        });

        it("should clamp pagination to the controller limits", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 0,
                    perPage: 500,
                });

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 100,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should default pagination when pagination values are missing", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({});

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should clamp a negative page to 1", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: -10,
                    perPage: 20,
                });

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should clamp perPage below 1 to 1", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 1,
                    perPage: 0,
                });

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
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
                    perPage: 1000,
                });

            mockBrowseRoles
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 100,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to browse roles",
            );

            mockBrowseRoles
                .mockRejectedValue(serviceError);

            await invoke("browse");

            expect(mockBrowseRoles)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize query context is missing", async () => {
            delete req.sanitize;

            await invoke("browse");

            expect(mockBrowseRoles)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });

        it("should forward an error when app pagination context is missing", async () => {
            req.app = undefined;

            await invoke("browse");

            expect(mockBrowseRoles)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });

        it("should forward an error when app pagination getter returns undefined", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue(undefined);

            await invoke("browse");

            expect(mockBrowseRoles)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("view()", () => {
        it("should find a role using the numeric route ID", async () => {
            req.params = {
                id: "42",
            };

            const result: Role = {
                ...role,
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

            const result: Role = {
                ...role,
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

            const result: Role = {
                ...role,
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
                "Role not found",
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
        it("should hard delete a role using the numeric route ID", async () => {
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
                "Failed to delete role",
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
