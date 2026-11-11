import {beforeEach, describe, expect, it, vi} from "vitest";
import {VerificationService} from "./verification.service";
import {VerificationRepository} from "./verification.repository";
import {UserRepository} from "../../users/user.repository";
import {SettingService} from "../../system/settings/setting.service";
import {OutboxRepository} from "../../jobs/outbox.repository";
import {MailService} from "../../../common/interfaces/mail.interface";
import {SecurityUtil} from "../../../common/utils/security.util";
import {DateUtil} from "../../../common/utils/date.util";
import {OUTBOX_TYPES} from "../../jobs/outbox.interface";
import Messages from "../../../common/utils/messages";

describe("VerificationService", () => {
    let service: VerificationService;

    let securityUtil: {hash: ReturnType<typeof vi.fn>};
    let verificationRepository: {
        create: ReturnType<typeof vi.fn>;
        findByHash: ReturnType<typeof vi.fn>;
        invalidateForUserChannel: ReturnType<typeof vi.fn>;
        incrementAttempts: ReturnType<typeof vi.fn>;
        consume: ReturnType<typeof vi.fn>;
        isTargetVerified: ReturnType<typeof vi.fn>;
    };
    let userRepository: {update: ReturnType<typeof vi.fn>};
    let settingService: {getCache: ReturnType<typeof vi.fn>};
    let outboxRepository: {enqueue: ReturnType<typeof vi.fn>};
    let mailService: {send: ReturnType<typeof vi.fn>};
    let dateUtil: {expiredAt: ReturnType<typeof vi.fn>};

    const policy = {
        emailTtlHours: 24,
        phoneTtlMinutes: 10,
        maxAttempts: 5,
        requiredForRecovery: false,
    };

    beforeEach(() => {
        vi.clearAllMocks();

        securityUtil = {
            hash: vi.fn().mockResolvedValue("hashed"),
        };

        verificationRepository = {
            create: vi.fn().mockResolvedValue({id: "v1"}),
            findByHash: vi.fn(),
            invalidateForUserChannel: vi.fn().mockResolvedValue(1),
            incrementAttempts: vi.fn(),
            consume: vi.fn(),
            isTargetVerified: vi.fn().mockResolvedValue(true),
        };

        userRepository = {update: vi.fn()};
        settingService = {
            getCache: vi.fn().mockResolvedValue({
                pri: {
                    ver_eml_snd: "no-reply@example.com",
                    ver_eml_sbj: "Verify",
                    ver_eml_ttl: "24",
                    ver_phn_ttl: "10",
                    ver_max_try: "5",
                    ver_req_rcv: "0",
                },
            }),
        };

        outboxRepository = {enqueue: vi.fn().mockResolvedValue({id: "1"})};
        mailService = {send: vi.fn()};

        dateUtil = {
            expiredAt: vi.fn().mockReturnValue(new Date("2030-01-01")),
        };

        service = new VerificationService(
            securityUtil as unknown as SecurityUtil,
            verificationRepository as unknown as VerificationRepository,
            userRepository as unknown as UserRepository,
            settingService as unknown as SettingService,
            outboxRepository as unknown as OutboxRepository,
            mailService as unknown as MailService,
            dateUtil as unknown as DateUtil,
        );
    });

    describe("getPolicy()", () => {
        it("reads the policy from the settings", async () => {
            const result = await service.getPolicy();

            expect(result).toEqual(policy);
        });
    });

    describe("send()", () => {
        it("stores a hashed token and queues the email", async () => {
            const result = await service.send(
                1,
                "email",
                "user@example.com",
            );

            expect(result.sent).toBe(true);
            expect(result.expiresAt).toBeInstanceOf(Date);

            const stored = verificationRepository.create.mock.calls[0][0];

            expect(stored.token_hash).toMatch(/^[a-f0-9]{64}$/);
            expect(stored.token_hash).not.toBe(
                stored.token_hash.toUpperCase(),
            );
            expect(stored.user_id).toBe(1);
            expect(stored.channel).toBe("email");

            expect(outboxRepository.enqueue).toHaveBeenCalledWith(
                expect.objectContaining({type: OUTBOX_TYPES.SEND_EMAIL}),
            );
        });

        it("invalidates the previous token for the channel", async () => {
            await service.send(1, "email", "user@example.com");

            expect(
                verificationRepository.invalidateForUserChannel,
            ).toHaveBeenCalledWith(1, "email");
        });

        it("does not queue an email for the phone channel", async () => {
            await service.send(1, "phone", "+1234567890");

            expect(outboxRepository.enqueue).not.toHaveBeenCalled();
        });
    });

    describe("confirm()", () => {
        it("consumes the token and sets the verification flag", async () => {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60_000),
                consumed_at: null,
                attempts: 0,
            });

            const result = await service.confirm(1, "token");

            expect(result).toEqual({verified: true, channel: "email"});
            expect(verificationRepository.consume).toHaveBeenCalledWith("v1");
            expect(userRepository.update).toHaveBeenCalledWith(1, {
                is_email_verified: true,
            });
        });

        it("sets the phone flag for a phone token", async () => {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "phone",
                target: "+1234567890",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60_000),
                consumed_at: null,
                attempts: 0,
            });

            await service.confirm(1, "token");

            expect(userRepository.update).toHaveBeenCalledWith(1, {
                is_phone_verified: true,
            });
        });

        it("rejects an unknown token", async () => {
            verificationRepository.findByHash.mockResolvedValue(null);

            await expect(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: Messages.INVALID_TOKEN.code,
            });
        });

        it("rejects a token belonging to another user", async () => {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 2,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60_000),
                consumed_at: null,
                attempts: 0,
            });

            await expect(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: Messages.INVALID_TOKEN.code,
            });
        });

        it("rejects a token that was already used", async () => {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60_000),
                consumed_at: new Date(),
                attempts: 0,
            });

            await expect(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: Messages.INVALID_TOKEN.code,
            });
        });

        it("rejects an expired token", async () => {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() - 1000),
                consumed_at: null,
                attempts: 0,
            });

            await expect(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: Messages.EXPIRED_TOKEN.code,
            });
        });

        it("rejects a token that used up its attempts", async () => {
            verificationRepository.findByHash.mockResolvedValue({
                id: "v1",
                user_id: 1,
                channel: "email",
                target: "user@example.com",
                token_hash: "hash",
                expires_at: new Date(Date.now() + 60_000),
                consumed_at: null,
                attempts: 5,
            });

            await expect(service.confirm(1, "token")).rejects.toMatchObject({
                errorCode: Messages.TOO_MANY_ATTEMPTS.code,
            });
        });
    });

    describe("resetFlag()", () => {
        it("invalidates the tokens and clears the flag", async () => {
            await service.resetFlag(1, "email");

            expect(
                verificationRepository.invalidateForUserChannel,
            ).toHaveBeenCalledWith(1, "email");
            expect(userRepository.update).toHaveBeenCalledWith(1, {
                is_email_verified: false,
            });
        });

        it("clears the phone flag", async () => {
            await service.resetFlag(1, "phone");

            expect(userRepository.update).toHaveBeenCalledWith(1, {
                is_phone_verified: false,
            });
        });
    });

    describe("isTargetVerified()", () => {
        it("delegates to the repository", async () => {
            const result = await service.isTargetVerified(
                1,
                "email",
                "user@example.com",
            );

            expect(result).toBe(true);
            expect(
                verificationRepository.isTargetVerified,
            ).toHaveBeenCalledWith(1, "email", "user@example.com");
        });
    });
});
