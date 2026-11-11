import {beforeEach, describe, expect, it, vi} from "vitest";
import {HealthService} from "./health.service";

vi.mock("../../../config/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock("../../../config/redis", () => ({
    DBRedis: {
        publisher: undefined as {status: string} | undefined,
    },
}));

vi.mock("../../../config/database", () => ({
    db: {},
}));

describe("HealthService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("live()", () => {
        it("reports the process as alive", () => {
            const service = new HealthService(
                vi.fn().mockResolvedValue("up"),
                vi.fn().mockReturnValue("disabled"),
            );

            const result = service.live();

            expect(result.status).toBe("alive");
            expect(typeof result.uptimeSeconds).toBe("number");
        });
    });

    describe("ready()", () => {
        it("is ready when the database is up and Redis is disabled", async () => {
            const service = new HealthService(
                vi.fn().mockResolvedValue("up"),
                vi.fn().mockReturnValue("disabled"),
            );

            const report = await service.ready();

            expect(report.status).toBe("ready");
            expect(report.dependencies.database).toBe("up");
            expect(report.dependencies.redis).toBe("disabled");
        });

        it("is not ready when the database is down", async () => {
            const service = new HealthService(
                vi.fn().mockResolvedValue("down"),
                vi.fn().mockReturnValue("disabled"),
            );

            const report = await service.ready();

            expect(report.status).toBe("not_ready");
            expect(report.dependencies.database).toBe("down");
        });

        it("is not ready when Redis is down", async () => {
            const service = new HealthService(
                vi.fn().mockResolvedValue("up"),
                vi.fn().mockReturnValue("down"),
            );

            const report = await service.ready();

            expect(report.status).toBe("not_ready");
            expect(report.dependencies.redis).toBe("down");
        });

        it("is ready when Redis is up", async () => {
            const service = new HealthService(
                vi.fn().mockResolvedValue("up"),
                vi.fn().mockReturnValue("up"),
            );

            const report = await service.ready();

            expect(report.status).toBe("ready");
        });
    });
});
