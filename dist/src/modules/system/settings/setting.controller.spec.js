"use strict";
// __test__/modules/system/controllers/setting.controller.spec.ts
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
const setting_controller_1 = require("./setting.controller");
const errors_1 = require("../../../common/utils/errors");
const { mockCreateSetting, mockUpdateSetting, mockBrowseSettings, mockInitializer, mockGetCache, mockFindById, mockHardDelete, } = vitest_1.vi.hoisted(() => ({
    mockCreateSetting: vitest_1.vi.fn(),
    mockUpdateSetting: vitest_1.vi.fn(),
    mockBrowseSettings: vitest_1.vi.fn(),
    mockInitializer: vitest_1.vi.fn(),
    mockGetCache: vitest_1.vi.fn(),
    mockFindById: vitest_1.vi.fn(),
    mockHardDelete: vitest_1.vi.fn(),
}));
vitest_1.vi.mock("../../../../src/common/utils/catch-async", () => ({
    default: (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next),
}));
(0, vitest_1.describe)("SettingController", () => {
    let controller;
    let req;
    let res;
    let next;
    const setting = {
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
        const settingService = {
            createSetting: mockCreateSetting,
            updateSetting: mockUpdateSetting,
            browseSettings: mockBrowseSettings,
            initializer: mockInitializer,
            getCache: mockGetCache,
            findById: mockFindById,
            hardDelete: mockHardDelete,
        };
        controller = new setting_controller_1.SettingController(settingService);
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
                get: vitest_1.vi.fn().mockReturnValue({
                    page: 1,
                    perPage: 20,
                }),
            },
        };
    });
    (0, vitest_1.describe)("create()", () => {
        (0, vitest_1.it)("should create a setting and return the created setting ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                name: "Max Login Tries",
                slug: "mx_log_try",
                value: "5",
                description: "Maximum login attempts",
                type: "integer",
                is_disabled: false,
                is_public: false,
            };
            const createdSetting = Object.assign(Object.assign({}, setting), { id: 42 });
            req.sanitize.data = createData;
            mockCreateSetting.mockResolvedValue(createdSetting);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateSetting)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateSetting)
                .toHaveBeenCalledWith(createData);
            expectJsonResponse(201, {
                id: 42,
            });
        }));
        (0, vitest_1.it)("should pass the exact sanitized data to the service", () => __awaiter(void 0, void 0, void 0, function* () {
            const createData = {
                name: "Token Expiration",
                slug: "tkn_exp",
                value: "3600",
                description: "Authentication token expiration",
                type: "integer",
                is_disabled: false,
                is_public: true,
            };
            req.sanitize.data = createData;
            mockCreateSetting.mockResolvedValue(Object.assign(Object.assign(Object.assign({}, setting), { id: 99 }), createData));
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateSetting)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockCreateSetting)
                .toHaveBeenCalledWith(createData);
            expectJsonResponse(201, {
                id: 99,
            });
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to create setting");
            mockCreateSetting.mockRejectedValue(serviceError);
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateSetting)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("create");
            (0, vitest_1.expect)(mockCreateSetting)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("update()", () => {
        (0, vitest_1.it)("should update a setting using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            const updateData = {
                name: "Maximum Login Attempts",
                description: "Updated description",
            };
            req.params = {
                id: "42",
            };
            req.sanitize.data = updateData;
            mockUpdateSetting.mockResolvedValue(Object.assign(Object.assign(Object.assign({}, setting), { id: 42 }), updateData));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateSetting)
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
                name: "Test Setting",
            };
            mockUpdateSetting.mockResolvedValue(Object.assign(Object.assign({}, setting), { id: 123 }));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateSetting)
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
            (0, vitest_1.expect)(mockUpdateSetting)
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
                name: "Max Login Tries",
            };
            mockUpdateSetting.mockResolvedValue(Object.assign(Object.assign({}, setting), { id: 1000 }));
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUpdateSetting)
                .toHaveBeenCalledWith(1000, req.sanitize.data);
            expectJsonResponse(200, {
                id: 1000,
            });
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to update setting");
            mockUpdateSetting.mockRejectedValue(serviceError);
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateSetting)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when route params are missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = undefined;
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateSetting)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when sanitize context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("update");
            (0, vitest_1.expect)(mockUpdateSetting)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("browse()", () => {
        const browseResult = [
            setting,
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
        (0, vitest_1.it)("should browse settings using sanitized filters and pagination", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => {
                var _a;
                const values = {
                    type: "integer",
                    search: "  login  ",
                    is_disabled: "1",
                    is_public: "0",
                };
                return (_a = values[key]) !== null && _a !== void 0 ? _a : null;
            });
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 2,
                perPage: 25,
            });
            mockBrowseSettings
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledWith({
                page: 2,
                perPage: 25,
                is_disabled: true,
                is_public: false,
                type: "integer",
                search: "login",
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should not apply a filter when the parameter is absent", () => __awaiter(void 0, void 0, void 0, function* () {
            /*
             * Regression test: an absent filter must not become
             * `is_disabled=false`, which silently hid every enabled
             * setting.
             */
            req.sanitize.query.get
                .mockReturnValue(undefined);
            mockBrowseSettings
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should reject an invalid boolean filter", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => key === "is_public" ? "maybe" : null);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.objectContaining({
                statusCode: 400,
            }));
        }));
        (0, vitest_1.it)("should reject an unknown setting type", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => (key === "type" ? "blob" : null));
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.objectContaining({
                statusCode: 400,
            }));
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
            mockBrowseSettings
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should convert visibility filters to booleans", () => __awaiter(void 0, void 0, void 0, function* () {
            req.sanitize.query.get
                .mockImplementation((key) => {
                if (key === "is_disabled") {
                    return "0";
                }
                if (key === "is_public") {
                    return "1";
                }
                return null;
            });
            mockBrowseSettings
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 20,
                is_disabled: false,
                is_public: true,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should clamp pagination to the controller limits", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app.get = vitest_1.vi.fn()
                .mockReturnValue({
                page: 0,
                perPage: 500,
            });
            mockBrowseSettings
                .mockResolvedValue(browseResult);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledWith({
                page: 1,
                perPage: 100,
            });
            expectJsonResponse(200, browseResult);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to browse settings");
            mockBrowseSettings
                .mockRejectedValue(serviceError);
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .toHaveBeenCalledTimes(1);
            expectErrorForwarded(serviceError);
        }));
        (0, vitest_1.it)("should forward an error when sanitize query context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            delete req.sanitize;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
        (0, vitest_1.it)("should forward an error when app pagination context is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            req.app = undefined;
            yield invoke("browse");
            (0, vitest_1.expect)(mockBrowseSettings)
                .not.toHaveBeenCalled();
            expectErrorForwarded(vitest_1.expect.any(TypeError));
        }));
    });
    (0, vitest_1.describe)("values()", () => {
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
        (0, vitest_1.it)("should return the public settings from the cache", () => __awaiter(void 0, void 0, void 0, function* () {
            /*
             * The endpoint is served from the shared cache, so a
             * request no longer runs two database queries.
             */
            mockGetCache
                .mockResolvedValue(initializerResult);
            yield invoke("values");
            (0, vitest_1.expect)(mockGetCache)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockInitializer)
                .not.toHaveBeenCalled();
            expectJsonResponse(200, initializerResult.pub);
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Failed to initialize settings");
            mockGetCache.mockRejectedValue(serviceError);
            yield invoke("values");
            (0, vitest_1.expect)(mockGetCache)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(next)
                .toHaveBeenCalledWith(serviceError);
            /*
             * An error is forwarded to the error middleware; the
             * controller must not write a response itself.
             */
            (0, vitest_1.expect)(res.status)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.json)
                .not.toHaveBeenCalled();
            (0, vitest_1.expect)(res.send)
                .not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("view()", () => {
        (0, vitest_1.it)("should find a setting using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
            req.params = {
                id: "42",
            };
            const result = Object.assign(Object.assign({}, setting), { id: 42 });
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
            const result = Object.assign(Object.assign({}, setting), { id: 123 });
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
            mockFindById
                .mockResolvedValue(Object.assign(Object.assign({}, setting), { id: 1000 }));
            yield invoke("view");
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockFindById)
                .toHaveBeenCalledWith(1000);
            expectJsonResponse(200, Object.assign(Object.assign({}, setting), { id: 1000 }));
        }));
        (0, vitest_1.it)("should forward service errors to the next middleware", () => __awaiter(void 0, void 0, void 0, function* () {
            const serviceError = new Error("Setting not found");
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
        (0, vitest_1.it)("should hard delete a setting using the numeric route ID", () => __awaiter(void 0, void 0, void 0, function* () {
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
            const serviceError = new Error("Failed to delete setting");
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
