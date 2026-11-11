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
// src/common/utils/catch-async.spec.ts
const vitest_1 = require("vitest");
const catch_async_1 = __importDefault(require("./catch-async"));
(0, vitest_1.describe)("catchAsync Utility", () => {
    const mockReq = {};
    const mockRes = {};
    let mockNext;
    (0, vitest_1.beforeEach)(() => {
        // Reset mock call counts before every individual test
        mockNext = vitest_1.vi.fn();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("should execute the handler successfully and not call next() on resolution", () => __awaiter(void 0, void 0, void 0, function* () {
        const asyncRouteHandler = vitest_1.vi.fn().mockResolvedValue("success data");
        const wrappedHandler = (0, catch_async_1.default)(asyncRouteHandler);
        yield wrappedHandler(mockReq, mockRes, mockNext);
        (0, vitest_1.expect)(asyncRouteHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
        (0, vitest_1.expect)(mockNext).not.toHaveBeenCalled();
    }));
    (0, vitest_1.it)("should catch asynchronous errors and forward them to next()", () => __awaiter(void 0, void 0, void 0, function* () {
        const testError = new Error("Database connection failed");
        const asyncRouteHandler = vitest_1.vi.fn().mockRejectedValue(testError);
        const wrappedHandler = (0, catch_async_1.default)(asyncRouteHandler);
        yield wrappedHandler(mockReq, mockRes, mockNext);
        (0, vitest_1.expect)(asyncRouteHandler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
        (0, vitest_1.expect)(mockNext).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(mockNext).toHaveBeenCalledWith(testError);
    }));
    (0, vitest_1.it)("should catch synchronous errors thrown inside the async wrapper and forward them to next()", () => __awaiter(void 0, void 0, void 0, function* () {
        const testError = new Error("Synchronous breakdown");
        const asyncRouteHandler = vitest_1.vi.fn().mockImplementation(() => __awaiter(void 0, void 0, void 0, function* () {
            throw testError;
        }));
        const wrappedHandler = (0, catch_async_1.default)(asyncRouteHandler);
        yield wrappedHandler(mockReq, mockRes, mockNext);
        (0, vitest_1.expect)(mockNext).toHaveBeenCalledTimes(1);
        (0, vitest_1.expect)(mockNext).toHaveBeenCalledWith(testError);
    }));
});
