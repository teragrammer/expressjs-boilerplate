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
const audit_service_1 = require("./audit.service");
const audit_interface_1 = require("./audit.interface");
vitest_1.vi.mock("../../config/logger", () => ({
    logger: {
        info: vitest_1.vi.fn(),
        warn: vitest_1.vi.fn(),
        error: vitest_1.vi.fn(),
    },
}));
(0, vitest_1.describe)("AuditService", () => {
    let service;
    let auditRepository;
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
        auditRepository = {
            append: vitest_1.vi.fn().mockResolvedValue({ id: "1" }),
            browse: vitest_1.vi.fn().mockResolvedValue([]),
            count: vitest_1.vi.fn().mockResolvedValue(0),
        };
        service = new audit_service_1.AuditService(auditRepository);
    });
    (0, vitest_1.describe)("redactMetadata()", () => {
        (0, vitest_1.it)("removes sensitive keys", () => {
            const result = (0, audit_service_1.redactMetadata)({
                password: "secret",
                new_password: "secret",
                code: "123456",
                token: "abc",
                role_id: 3,
            });
            (0, vitest_1.expect)(result.password).toBe("[REDACTED]");
            (0, vitest_1.expect)(result.new_password).toBe("[REDACTED]");
            (0, vitest_1.expect)(result.code).toBe("[REDACTED]");
            (0, vitest_1.expect)(result.token).toBe("[REDACTED]");
            (0, vitest_1.expect)(result.role_id).toBe(3);
        });
        (0, vitest_1.it)("masks an email address", () => {
            const result = (0, audit_service_1.redactMetadata)({
                email: "john.doe@example.com",
            });
            (0, vitest_1.expect)(result.email).not.toContain("john.doe");
            (0, vitest_1.expect)(result.email).toContain("@example.com");
        });
        (0, vitest_1.it)("masks a phone number", () => {
            const result = (0, audit_service_1.redactMetadata)({
                phone: "+1234567890",
            });
            (0, vitest_1.expect)(result.phone).not.toContain("456789");
        });
        (0, vitest_1.it)("walks nested objects and arrays", () => {
            const result = (0, audit_service_1.redactMetadata)({
                user: { password: "secret", name: "John" },
                items: [{ token: "abc" }],
            });
            (0, vitest_1.expect)(result.user.password).toBe("[REDACTED]");
            (0, vitest_1.expect)(result.user.name).toBe("John");
            (0, vitest_1.expect)(result.items[0].token).toBe("[REDACTED]");
        });
        (0, vitest_1.it)("truncates a deeply nested value", () => {
            let deep = { value: "x" };
            for (let i = 0; i < 10; i += 1) {
                deep = { nested: deep };
            }
            (0, vitest_1.expect)(JSON.stringify((0, audit_service_1.redactMetadata)(deep))).toContain("TRUNCATED");
        });
    });
    (0, vitest_1.describe)("record()", () => {
        (0, vitest_1.it)("writes an event with the actor and the request context", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.record({
                action: audit_interface_1.AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
                outcome: "success",
                actorUserId: 5,
                targetType: "user",
                targetId: 9,
                metadata: { role: "admin" },
            });
            (0, vitest_1.expect)(auditRepository.append).toHaveBeenCalledTimes(1);
            const event = auditRepository.append.mock.calls[0][0];
            (0, vitest_1.expect)(event.action).toBe(audit_interface_1.AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED);
            (0, vitest_1.expect)(event.outcome).toBe("success");
            (0, vitest_1.expect)(event.actorUserId).toBe(5);
            (0, vitest_1.expect)(event.targetId).toBe(9);
            (0, vitest_1.expect)(event.metadata).toEqual({ role: "admin" });
        }));
        (0, vitest_1.it)("does not throw when the write fails", () => __awaiter(void 0, void 0, void 0, function* () {
            auditRepository.append.mockRejectedValue(new Error("db down"));
            yield (0, vitest_1.expect)(service.record({
                action: audit_interface_1.AUDIT_ACTIONS.USER_CREATED,
                outcome: "success",
            })).resolves.toBeUndefined();
        }));
    });
    (0, vitest_1.describe)("success() and failure()", () => {
        (0, vitest_1.it)("records a successful event", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.success(audit_interface_1.AUDIT_ACTIONS.AUTH_LOGOUT);
            (0, vitest_1.expect)(auditRepository.append).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                action: audit_interface_1.AUDIT_ACTIONS.AUTH_LOGOUT,
                outcome: "success",
            }));
        }));
        (0, vitest_1.it)("records a failed event", () => __awaiter(void 0, void 0, void 0, function* () {
            yield service.failure(audit_interface_1.AUDIT_ACTIONS.AUTH_LOGIN_FAILED);
            (0, vitest_1.expect)(auditRepository.append).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
                action: audit_interface_1.AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
                outcome: "failure",
            }));
        }));
    });
    (0, vitest_1.describe)("browse()", () => {
        (0, vitest_1.it)("returns the items and the total", () => __awaiter(void 0, void 0, void 0, function* () {
            auditRepository.browse.mockResolvedValue([{ id: "1" }]);
            auditRepository.count.mockResolvedValue(1);
            const result = yield service.browse({
                page: 1,
                perPage: 20,
            });
            (0, vitest_1.expect)(result.items).toHaveLength(1);
            (0, vitest_1.expect)(result.total).toBe(1);
        }));
    });
});
