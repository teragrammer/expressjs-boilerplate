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
const health_service_1 = require("./health.service");
vitest_1.vi.mock("../../../config/logger", () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock("../../../config/redis", () => ({
    DBRedis: {
        publisher: undefined,
    },
}));
vitest_1.vi.mock("../../../config/database", () => ({
    db: {},
}));
(0, vitest_1.describe)("HealthService", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.describe)("live()", () => {
        (0, vitest_1.it)("reports the process as alive", () => {
            const service = new health_service_1.HealthService(vitest_1.vi.fn().mockResolvedValue("up"), vitest_1.vi.fn().mockReturnValue("disabled"));
            const result = service.live();
            (0, vitest_1.expect)(result.status).toBe("alive");
            (0, vitest_1.expect)(typeof result.uptimeSeconds).toBe("number");
        });
    });
    (0, vitest_1.describe)("ready()", () => {
        (0, vitest_1.it)("is ready when the database is up and Redis is disabled", () => __awaiter(void 0, void 0, void 0, function* () {
            const service = new health_service_1.HealthService(vitest_1.vi.fn().mockResolvedValue("up"), vitest_1.vi.fn().mockReturnValue("disabled"));
            const report = yield service.ready();
            (0, vitest_1.expect)(report.status).toBe("ready");
            (0, vitest_1.expect)(report.dependencies.database).toBe("up");
            (0, vitest_1.expect)(report.dependencies.redis).toBe("disabled");
        }));
        (0, vitest_1.it)("is not ready when the database is down", () => __awaiter(void 0, void 0, void 0, function* () {
            const service = new health_service_1.HealthService(vitest_1.vi.fn().mockResolvedValue("down"), vitest_1.vi.fn().mockReturnValue("disabled"));
            const report = yield service.ready();
            (0, vitest_1.expect)(report.status).toBe("not_ready");
            (0, vitest_1.expect)(report.dependencies.database).toBe("down");
        }));
        (0, vitest_1.it)("is not ready when Redis is down", () => __awaiter(void 0, void 0, void 0, function* () {
            const service = new health_service_1.HealthService(vitest_1.vi.fn().mockResolvedValue("up"), vitest_1.vi.fn().mockReturnValue("down"));
            const report = yield service.ready();
            (0, vitest_1.expect)(report.status).toBe("not_ready");
            (0, vitest_1.expect)(report.dependencies.redis).toBe("down");
        }));
        (0, vitest_1.it)("is ready when Redis is up", () => __awaiter(void 0, void 0, void 0, function* () {
            const service = new health_service_1.HealthService(vitest_1.vi.fn().mockResolvedValue("up"), vitest_1.vi.fn().mockReturnValue("up"));
            const report = yield service.ready();
            (0, vitest_1.expect)(report.status).toBe("ready");
        }));
    });
});
