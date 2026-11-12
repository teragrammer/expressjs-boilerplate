// __test__/modules/system/controllers/setting.controller.spec.ts

import {beforeEach, describe, expect, it, vi,} from "vitest";
import {createHash} from "node:crypto";
import {NextFunction, Request, Response,} from "express";

import {SettingController} from "./setting.controller";
import {SettingService} from "./setting.service";
import {AuditService} from "../../audit/audit.service";
import {
    CreateSettingDTO,
    Setting,
    UpdateSettingDTO,
} from "./setting.interface";
import {AppError} from "../../../common/utils/errors";

const {
    mockCreateSetting,
    mockUpdateSetting,
    mockBrowseSettings,
    mockInitializer,
    mockGetCache,
    mockFindById,
    mockHardDelete,
} = vi.hoisted(() => ({
    mockCreateSetting: vi.fn(),
    mockUpdateSetting: vi.fn(),
    mockBrowseSettings: vi.fn(),
    mockInitializer: vi.fn(),
    mockGetCache: vi.fn(),
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

describe("SettingController", () => {
    let controller: SettingController;

    let req: Partial<Request> & {
        sanitize?: any;
        params?: Record<string, string>;
    };

    let res: Partial<Response>;
    let next: NextFunction;

    const setting: Setting = {
        id: 1,
        name: "Max Login Tries",
        slug: "mx_log_try",
        value: "5",
        description: "Maximum login attempts",
        type: "integer",
        is_disabled: false,
        is_public: false,
        created_at: new Date(),
        updated_at: new Date(),
    };

    const invoke = async (
        method:
            | "create"
            | "update"
            | "browse"
            | "values"
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

        const settingService = {
            createSetting: mockCreateSetting,
            updateSetting: mockUpdateSetting,
            browseSettings: mockBrowseSettings,
            initializer: mockInitializer,
            getCache: mockGetCache,
            findById: mockFindById,
            hardDelete: mockHardDelete,
        } as unknown as SettingService;

        controller = new SettingController(
            settingService,
            auditService as unknown as AuditService,
        );

        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnThis(),
            setHeader: vi.fn().mockReturnThis(),
        };

        next = vi.fn();

        req = {
            params: {
                id: "1",
            },

            headers: {},

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
                    name: "Max Login Tries",
                    slug: "mx_log_try",
                    value: "5",
                    description: "Maximum login attempts",
                    type: "integer",
                    is_disabled: false,
                    is_public: false,
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
        it("should create a setting and return the created setting ID", async () => {
            const createData: CreateSettingDTO = {
                name: "Max Login Tries",
                slug: "mx_log_try",
                value: "5",
                description: "Maximum login attempts",
                type: "integer",
                is_disabled: false,
                is_public: false,
            };

            const createdSetting: Setting = {
                ...setting,
                id: 42,
            };

            req.sanitize!.data = createData;

            mockCreateSetting.mockResolvedValue(
                createdSetting,
            );

            await invoke("create");

            expect(mockCreateSetting)
                .toHaveBeenCalledTimes(1);

            expect(mockCreateSetting)
                .toHaveBeenCalledWith(createData);

            expectJsonResponse(201, {
                id: 42,
            });
        });

        it("should pass the exact sanitized data to the service", async () => {
            const createData: CreateSettingDTO = {
                name: "Token Expiration",
                slug: "tkn_exp",
                value: "3600",
                description: "Authentication token expiration",
                type: "integer",
                is_disabled: false,
                is_public: true,
            };

            req.sanitize!.data = createData;

            mockCreateSetting.mockResolvedValue({
                ...setting,
                id: 99,
                ...createData,
            });

            await invoke("create");

            expect(mockCreateSetting)
                .toHaveBeenCalledTimes(1);

            expect(mockCreateSetting)
                .toHaveBeenCalledWith(createData);

            expectJsonResponse(201, {
                id: 99,
            });
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to create setting",
            );

            mockCreateSetting.mockRejectedValue(
                serviceError,
            );

            await invoke("create");

            expect(mockCreateSetting)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("create");

            expect(mockCreateSetting)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("update()", () => {
        it("should update a setting using the numeric route ID", async () => {
            const updateData: UpdateSettingDTO = {
                name: "Maximum Login Attempts",
                description: "Updated description",
            };

            req.params = {
                id: "42",
            };

            req.sanitize!.data = updateData;

            mockUpdateSetting.mockResolvedValue({
                ...setting,
                id: 42,
                ...updateData,
            });

            await invoke("update");

            expect(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);

            expect(mockUpdateSetting)
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
                name: "Test Setting",
            };

            mockUpdateSetting.mockResolvedValue({
                ...setting,
                id: 123,
            });

            await invoke("update");

            expect(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);

            expect(mockUpdateSetting)
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

                expect(mockUpdateSetting)
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
                name: "Max Login Tries",
            };

            mockUpdateSetting.mockResolvedValue({
                ...setting,
                id: 1000,
            });

            await invoke("update");

            expect(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);

            expect(mockUpdateSetting)
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
                "Failed to update setting",
            );

            mockUpdateSetting.mockRejectedValue(
                serviceError,
            );

            await invoke("update");

            expect(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when route params are missing", async () => {
            req.params = undefined;

            await invoke("update");

            expect(mockUpdateSetting)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });

        it("should forward an error when sanitize context is missing", async () => {
            delete req.sanitize;

            await invoke("update");

            expect(mockUpdateSetting)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("browse()", () => {
        const browseResult: Setting[] = [
            setting,
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

        it("should browse settings using sanitized filters and pagination", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        const values: Record<
                            string,
                            string | null
                        > = {
                            type: "integer",
                            search: "  login  ",
                            is_disabled: "1",
                            is_public: "0",
                        };

                        return values[key] ?? null;
                    },
                );

            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 2,
                    perPage: 25,
                });

            mockBrowseSettings
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseSettings)
                .toHaveBeenCalledTimes(1);

            expect(mockBrowseSettings)
                .toHaveBeenCalledWith({
                    page: 2,
                    perPage: 25,
                    is_disabled: true,
                    is_public: false,
                    type: "integer",
                    search: "login",
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should not apply a filter when the parameter is absent", async () => {
            /*
             * Regression test: an absent filter must not become
             * `is_disabled=false`, which silently hid every enabled
             * setting.
             */
            req.sanitize!.query.get
                .mockReturnValue(undefined);

            mockBrowseSettings
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseSettings)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });
        });

        it("should reject an invalid boolean filter", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) =>
                        key === "is_public" ? "maybe" : null,
                );

            await invoke("browse");

            expect(mockBrowseSettings)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.objectContaining({
                    statusCode: 400,
                }),
            );
        });

        it("should reject an unknown setting type", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => (key === "type" ? "blob" : null),
                );

            await invoke("browse");

            expect(mockBrowseSettings)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.objectContaining({
                    statusCode: 400,
                }),
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

            mockBrowseSettings
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseSettings)
                .toHaveBeenCalledTimes(1);

            expect(mockBrowseSettings)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should convert visibility filters to booleans", async () => {
            req.sanitize!.query.get
                .mockImplementation(
                    (key: string) => {
                        if (key === "is_disabled") {
                            return "0";
                        }

                        if (key === "is_public") {
                            return "1";
                        }

                        return null;
                    },
                );

            mockBrowseSettings
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseSettings)
                .toHaveBeenCalledWith({
                    page: 1,
                    perPage: 20,
                    is_disabled: false,
                    is_public: true,
                });

            expectJsonResponse(
                200,
                browseResult,
            );
        });

        it("should clamp pagination to the controller limits", async () => {
            req.app!.get = vi.fn()
                .mockReturnValue({
                    page: 0,
                    perPage: 500,
                });

            mockBrowseSettings
                .mockResolvedValue(browseResult);

            await invoke("browse");

            expect(mockBrowseSettings)
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
                "Failed to browse settings",
            );

            mockBrowseSettings
                .mockRejectedValue(serviceError);

            await invoke("browse");

            expect(mockBrowseSettings)
                .toHaveBeenCalledTimes(1);

            expectErrorForwarded(serviceError);
        });

        it("should forward an error when sanitize query context is missing", async () => {
            delete req.sanitize;

            await invoke("browse");

            expect(mockBrowseSettings)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });

        it("should forward an error when app pagination context is missing", async () => {
            req.app = undefined;

            await invoke("browse");

            expect(mockBrowseSettings)
                .not.toHaveBeenCalled();

            expectErrorForwarded(
                expect.any(TypeError),
            );
        });
    });

    describe("values()", () => {
        const initializerResult = {
            pri: {
                mx_log_try: 5,
                lck_prd: 900,
                tkn_exp: 3600,
                tta_req: 1,
                tta_eml_snd: "security@example.com",
                tta_eml_sbj: "Two-factor authentication",
                psr_eml_snd: "security@example.com",
                psr_eml_sbj: "Password recovery",
            },

            pub: {
                mx_log_try: 5,
                lck_prd: 900,
                tkn_exp: 3600,
                tta_req: 1,
                tta_eml_snd: "security@example.com",
                tta_eml_sbj: "Two-factor authentication",
                psr_eml_snd: "security@example.com",
                psr_eml_sbj: "Password recovery",
            },
        };

        it("should return the public settings from the cache", async () => {
            /*
             * The endpoint is served from the shared cache, so a
             * request no longer runs two database queries.
             */
            mockGetCache
                .mockResolvedValue(initializerResult);

            await invoke("values");

            expect(mockGetCache)
                .toHaveBeenCalledTimes(1);

            expect(mockInitializer)
                .not.toHaveBeenCalled();

            expectJsonResponse(
                200,
                initializerResult.pub,
            );

            expect(res.setHeader).toHaveBeenCalledWith(
                "Cache-Control",
                "public, max-age=60, must-revalidate",
            );

            expect(res.setHeader).toHaveBeenCalledWith(
                "ETag",
                expect.stringMatching(/^"[a-f0-9]{32}"$/),
            );
        });

        it("should return 304 when the client ETag matches", async () => {
            mockGetCache.mockResolvedValue(initializerResult);

            const etag = `"${createHash("sha256")
                .update(JSON.stringify(initializerResult.pub))
                .digest("hex")
                .slice(0, 32)}"`;

            req.headers = {"if-none-match": etag};

            await invoke("values");

            expect(res.status).toHaveBeenCalledTimes(1);
            expect(res.status).toHaveBeenCalledWith(304);
            expect(res.send).toHaveBeenCalledTimes(1);
            expect(res.send).toHaveBeenCalledWith();
            expect(res.json).not.toHaveBeenCalled();
            expect(next).not.toHaveBeenCalled();
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Failed to initialize settings",
            );

            mockGetCache.mockRejectedValue(serviceError);

            await invoke("values");

            expect(mockGetCache)
                .toHaveBeenCalledTimes(1);

            expect(next)
                .toHaveBeenCalledTimes(1);

            expect(next)
                .toHaveBeenCalledWith(serviceError);

            /*
             * An error is forwarded to the error middleware; the
             * controller must not write a response itself.
             */
            expect(res.status)
                .not.toHaveBeenCalled();

            expect(res.json)
                .not.toHaveBeenCalled();

            expect(res.send)
                .not.toHaveBeenCalled();
        });
    });

    describe("view()", () => {
        it("should find a setting using the numeric route ID", async () => {
            req.params = {
                id: "42",
            };

            const result: Setting = {
                ...setting,
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

            const result: Setting = {
                ...setting,
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

            mockFindById
                .mockResolvedValue({
                    ...setting,
                    id: 1000,
                });

            await invoke("view");

            expect(mockFindById)
                .toHaveBeenCalledTimes(1);

            expect(mockFindById)
                .toHaveBeenCalledWith(1000);

            expectJsonResponse(
                200,
                {
                    ...setting,
                    id: 1000,
                },
            );
        });

        it("should forward service errors to the next middleware", async () => {
            const serviceError = new Error(
                "Setting not found",
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
        it("should hard delete a setting using the numeric route ID", async () => {
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
                "Failed to delete setting",
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
