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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const request_middleware_1 = __importDefault(require("./request.middleware"));
(0, vitest_1.describe)("Request Middleware", () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;
    (0, vitest_1.beforeEach)(() => {
        mockRequest = {
            body: {},
            query: {},
        };
        mockResponse = {};
        nextFunction = vitest_1.vi.fn();
    });
    (0, vitest_1.describe)("Safe Pagination Calculations", () => {
        (0, vitest_1.it)("should compute offset, perPage and page when query params are valid strings", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                page: "3",
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.pagination).toEqual({
                page: 3,
                offset: 40, // (3 - 1) * 20
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should use default values when pagination parameters are missing or invalid", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                page: "invalid",
                per_page: "invalid",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.pagination).toEqual({
                page: 1,
                offset: 0, // (1 - 1) * 10
                perPage: 10,
            });
        }));
        (0, vitest_1.it)("should enforce minimum page of 1", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                page: "0",
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.pagination).toEqual({
                page: 1,
                offset: 0,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should enforce minimum perPage of 1", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                page: "2",
                per_page: "0",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.pagination).toEqual({
                page: 2,
                offset: 1,
                perPage: 1,
            });
        }));
        (0, vitest_1.it)("should enforce maximum perPage of 100", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                page: "2",
                per_page: "500",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.pagination).toEqual({
                page: 2,
                offset: 100,
                perPage: 100,
            });
        }));
        (0, vitest_1.it)("should floor decimal pagination values", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                page: "2.9",
                per_page: "10.8",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.pagination).toEqual({
                page: 2,
                offset: 10,
                perPage: 10,
            });
        }));
    });
    (0, vitest_1.describe)("Cursor Pagination", () => {
        (0, vitest_1.it)("should compute cursor pagination when cursor is a valid string", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                cursor: "123",
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: 123,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should floor decimal cursor values", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                cursor: "123.99",
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: 123,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should set cursor to undefined when cursor is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should set cursor to undefined when cursor is invalid", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                cursor: "invalid",
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should set cursor to undefined when cursor is zero", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                cursor: "0",
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should set cursor to undefined when cursor is negative", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                cursor: "-10",
                per_page: "20",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: undefined,
                perPage: 20,
            });
        }));
        (0, vitest_1.it)("should use the same validated perPage for cursor pagination", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                cursor: "100",
                per_page: "500",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: 100,
                perPage: 100,
            });
        }));
        (0, vitest_1.it)("should use default perPage when per_page is missing", () => __awaiter(void 0, void 0, void 0, function* () {
            mockRequest.query = {
                cursor: "100",
            };
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(mockRequest.cursorPagination).toEqual({
                cursor: 100,
                perPage: 10,
            });
        }));
    });
    (0, vitest_1.describe)("Middleware", () => {
        (0, vitest_1.it)("should call next", () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, request_middleware_1.default)(mockRequest, mockResponse, nextFunction);
            (0, vitest_1.expect)(nextFunction).toHaveBeenCalledTimes(1);
        }));
    });
});
