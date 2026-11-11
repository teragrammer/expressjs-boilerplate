import {beforeEach, describe, expect, it, vi} from "vitest";
import {AuditService, redactMetadata} from "./audit.service";
import {AuditRepository} from "./audit.repository";
import {AUDIT_ACTIONS} from "./audit.interface";

vi.mock("../../config/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe("AuditService", () => {
    let service: AuditService;

    let auditRepository: {
        append: ReturnType<typeof vi.fn>;
        browse: ReturnType<typeof vi.fn>;
        count: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        auditRepository = {
            append: vi.fn().mockResolvedValue({id: "1"}),
            browse: vi.fn().mockResolvedValue([]),
            count: vi.fn().mockResolvedValue(0),
        };

        service = new AuditService(
            auditRepository as unknown as AuditRepository,
        );
    });

    describe("redactMetadata()", () => {
        it("removes sensitive keys", () => {
            const result = redactMetadata({
                password: "secret",
                new_password: "secret",
                code: "123456",
                token: "abc",
                role_id: 3,
            }) as Record<string, unknown>;

            expect(result.password).toBe("[REDACTED]");
            expect(result.new_password).toBe("[REDACTED]");
            expect(result.code).toBe("[REDACTED]");
            expect(result.token).toBe("[REDACTED]");
            expect(result.role_id).toBe(3);
        });

        it("masks an email address", () => {
            const result = redactMetadata({
                email: "john.doe@example.com",
            }) as Record<string, string>;

            expect(result.email).not.toContain("john.doe");
            expect(result.email).toContain("@example.com");
        });

        it("masks a phone number", () => {
            const result = redactMetadata({
                phone: "+1234567890",
            }) as Record<string, string>;

            expect(result.phone).not.toContain("456789");
        });

        it("walks nested objects and arrays", () => {
            const result = redactMetadata({
                user: {password: "secret", name: "John"},
                items: [{token: "abc"}],
            }) as Record<string, any>;

            expect(result.user.password).toBe("[REDACTED]");
            expect(result.user.name).toBe("John");
            expect(result.items[0].token).toBe("[REDACTED]");
        });

        it("truncates a deeply nested value", () => {
            let deep: Record<string, unknown> = {value: "x"};

            for (let i = 0; i < 10; i += 1) {
                deep = {nested: deep};
            }

            expect(JSON.stringify(redactMetadata(deep))).toContain(
                "TRUNCATED",
            );
        });
    });

    describe("record()", () => {
        it("writes an event with the actor and the request context", async () => {
            await service.record({
                action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED,
                outcome: "success",
                actorUserId: 5,
                targetType: "user",
                targetId: 9,
                metadata: {role: "admin"},
            });

            expect(auditRepository.append).toHaveBeenCalledTimes(1);

            const event = auditRepository.append.mock.calls[0][0];

            expect(event.action).toBe(AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED);
            expect(event.outcome).toBe("success");
            expect(event.actorUserId).toBe(5);
            expect(event.targetId).toBe(9);
            expect(event.metadata).toEqual({role: "admin"});
        });

        it("does not throw when the write fails", async () => {
            auditRepository.append.mockRejectedValue(new Error("db down"));

            await expect(
                service.record({
                    action: AUDIT_ACTIONS.USER_CREATED,
                    outcome: "success",
                }),
            ).resolves.toBeUndefined();
        });
    });

    describe("success() and failure()", () => {
        it("records a successful event", async () => {
            await service.success(AUDIT_ACTIONS.AUTH_LOGOUT);

            expect(auditRepository.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: AUDIT_ACTIONS.AUTH_LOGOUT,
                    outcome: "success",
                }),
            );
        });

        it("records a failed event", async () => {
            await service.failure(AUDIT_ACTIONS.AUTH_LOGIN_FAILED);

            expect(auditRepository.append).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
                    outcome: "failure",
                }),
            );
        });
    });

    describe("browse()", () => {
        it("returns the items and the total", async () => {
            auditRepository.browse.mockResolvedValue([{id: "1"}] as never);
            auditRepository.count.mockResolvedValue(1);

            const result = await service.browse({
                page: 1,
                perPage: 20,
            });

            expect(result.items).toHaveLength(1);
            expect(result.total).toBe(1);
        });
    });
});
