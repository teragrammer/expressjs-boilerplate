import {beforeEach, describe, expect, it, vi} from "vitest";
import {PasswordRecoveryService} from "./password-recovery.service";
import {SecurityUtil} from "../../../common/utils/security.util";
import {PasswordRecoveryRepository} from "./password-recovery.repository";
import {UserRepository} from "../../users/user.repository";
import {RECOVERY_EMAIL, RECOVERY_PHONE} from "./password-recovery.interface";
import {SettingService} from "../../system/settings/setting.service";
import {MailService} from "../../../common/interfaces/mail.interface";

describe("PasswordRecoveryService Unit Tests", () => {
    let service: PasswordRecoveryService;
    let mockSecurityUtil: SecurityUtil;
    let mockRecoveryRepo: PasswordRecoveryRepository;
    let mockUserRepo: UserRepository;
    let mockSettingService: SettingService;
    let mockMailService: MailService;
    let mockTransaction: any;

    beforeEach(() => {
        mockTransaction = {} as any;

        mockSecurityUtil = {
            randomNumber: vi.fn().mockReturnValue("123456"),
            hash: vi.fn().mockResolvedValue("hashed_code"),
            compare: vi.fn(),
        } as unknown as SecurityUtil;

        mockRecoveryRepo = {
            findBySendTo: vi.fn(),
            create: vi.fn(),
            deleteById: vi.fn(),
            updateTries: vi.fn(),
            withTransaction: vi.fn(),
        } as unknown as PasswordRecoveryRepository;

        mockUserRepo = {
            findByEmail: vi.fn(),
            findByPhone: vi.fn(),
            updatePassword: vi.fn(),
        } as unknown as UserRepository;

        mockSettingService = {
            getCache: vi.fn().mockResolvedValue({
                pri: {
                    psr_eml_snd: "no-reply@example.com",
                    psr_eml_sbj: "Password Recovery",
                },
            }),
        } as unknown as SettingService;

        mockMailService = {
            send: vi.fn().mockResolvedValue(undefined),
        } as unknown as MailService;

        vi.mocked(mockRecoveryRepo.withTransaction).mockImplementation(
            async (callback: any) => callback(mockTransaction),
        );

        vi.mocked(mockRecoveryRepo.create).mockResolvedValue({
            id: 1,
        } as any);

        vi.mocked(mockRecoveryRepo.deleteById).mockResolvedValue(true);

        vi.mocked(mockUserRepo.updatePassword).mockResolvedValue(true);

        service = new PasswordRecoveryService(
            mockSecurityUtil,
            mockRecoveryRepo,
            mockUserRepo,
            mockSettingService,
            mockMailService,
        );
    });

    describe("sendRecoveryCode", () => {
        it("should return { sent: true } without sending code if user does not exist (Anti-User Enumeration)", async () => {
            vi.mocked(mockUserRepo.findByEmail).mockResolvedValue(null);

            const result = await service.sendRecoveryCode(
                RECOVERY_EMAIL,
                "unknown@example.com",
            );

            expect(mockUserRepo.findByEmail).toHaveBeenCalledWith(
                "unknown@example.com",
            );

            expect(mockRecoveryRepo.findBySendTo).not.toHaveBeenCalled();
            expect(mockRecoveryRepo.withTransaction).not.toHaveBeenCalled();
            expect(mockMailService.send).not.toHaveBeenCalled();

            expect(result).toEqual({
                sent: true,
            });
        });

        it("should throw AppError 429 if request is made within resend cooldown", async () => {
            vi.mocked(mockUserRepo.findByPhone).mockResolvedValue({
                id: 1,
            } as any);

            vi.mocked(mockRecoveryRepo.findBySendTo).mockResolvedValue({
                id: 10,
                next_resend_at: new Date(Date.now() + 60000),
            } as any);

            await expect(
                service.sendRecoveryCode(
                    RECOVERY_PHONE,
                    "1234567890",
                ),
            ).rejects.toMatchObject({
                statusCode: 429,
            });

            expect(
                mockRecoveryRepo.withTransaction,
            ).not.toHaveBeenCalled();
        });

        it("should generate hashed code and create recovery session successfully", async () => {
            vi.mocked(mockUserRepo.findByEmail).mockResolvedValue({
                id: 1,
            } as any);

            vi.mocked(mockRecoveryRepo.findBySendTo).mockResolvedValue(
                null,
            );

            const result = await service.sendRecoveryCode(
                RECOVERY_EMAIL,
                "user@example.com",
            );

            expect(
                mockSecurityUtil.randomNumber,
            ).toHaveBeenCalledWith(6);

            expect(
                mockSecurityUtil.hash,
            ).toHaveBeenCalledWith("123456");

            expect(
                mockRecoveryRepo.withTransaction,
            ).toHaveBeenCalledOnce();

            expect(
                mockRecoveryRepo.create,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: RECOVERY_EMAIL,
                    send_to: "user@example.com",
                    code: "hashed_code",
                    tries: 0,
                    next_try_at: null,
                    next_resend_at: expect.any(Date),
                    expired_at: expect.any(Date),
                }),
                mockTransaction,
            );

            expect(
                mockMailService.send,
            ).toHaveBeenCalledWith({
                to: "user@example.com",
                from: "no-reply@example.com",
                subject: "Password Recovery",
                text: "Recovery Code: 123456",
            });

            expect(result.sent).toBe(true);
            expect(result.nextResendAt).toBeInstanceOf(Date);
        });

        it("should delete the existing recovery session before creating a new one", async () => {
            vi.mocked(mockUserRepo.findByEmail).mockResolvedValue({
                id: 1,
            } as any);

            vi.mocked(mockRecoveryRepo.findBySendTo).mockResolvedValue({
                id: 99,
                next_resend_at: new Date(Date.now() - 60000),
            } as any);

            await service.sendRecoveryCode(
                RECOVERY_EMAIL,
                "user@example.com",
            );

            expect(
                mockRecoveryRepo.deleteById,
            ).toHaveBeenCalledWith(
                99,
                mockTransaction,
            );

            expect(
                mockRecoveryRepo.create,
            ).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: RECOVERY_EMAIL,
                    send_to: "user@example.com",
                    code: "hashed_code",
                }),
                mockTransaction,
            );
        });
    });

    describe("resetPassword", () => {
        it("should throw AppError if no recovery record exists", async () => {
            vi.mocked(
                mockRecoveryRepo.findBySendTo,
            ).mockResolvedValue(null);

            await expect(
                service.resetPassword(
                    RECOVERY_EMAIL,
                    "user@example.com",
                    "123456",
                    "newPass123",
                ),
            ).rejects.toMatchObject({
                statusCode: 401,
                errorCode: "INVALID_TOKEN",
            });

            expect(
                mockRecoveryRepo.deleteById,
            ).not.toHaveBeenCalled();
        });

        it("should delete the expired recovery record and throw AppError", async () => {
            vi.mocked(
                mockRecoveryRepo.findBySendTo,
            ).mockResolvedValue({
                id: 99,
                expired_at: new Date(Date.now() - 60000),
                tries: 0,
                next_try_at: null,
                code: "hashed_code",
            } as any);

            await expect(
                service.resetPassword(
                    RECOVERY_EMAIL,
                    "user@example.com",
                    "123456",
                    "newPass123",
                ),
            ).rejects.toMatchObject({
                statusCode: 401,
                errorCode: "EXPIRED_TOKEN",
            });

            expect(
                mockRecoveryRepo.deleteById,
            ).toHaveBeenCalledWith(99);
        });

        it("should throw AppError 429 if user is currently locked out by next_try_at", async () => {
            vi.mocked(
                mockRecoveryRepo.findBySendTo,
            ).mockResolvedValue({
                id: 99,
                expired_at: new Date(Date.now() + 600000),
                next_try_at: new Date(Date.now() + 60000),
                tries: 0,
                code: "hashed_code",
            } as any);

            await expect(
                service.resetPassword(
                    RECOVERY_EMAIL,
                    "user@example.com",
                    "123456",
                    "newPass123",
                ),
            ).rejects.toMatchObject({
                statusCode: 429,
                errorCode: "TOO_MANY_ATTEMPTS",
            });

            expect(
                mockSecurityUtil.compare,
            ).not.toHaveBeenCalled();
        });

        it("should increment tries on code mismatch and enforce lockout when reaching MAX_TRIES", async () => {
            vi.mocked(
                mockRecoveryRepo.findBySendTo,
            ).mockResolvedValue({
                id: 99,
                expired_at: new Date(Date.now() + 600000),
                next_try_at: null,
                code: "hashed_correct_code",
                tries: 4,
            } as any);

            vi.mocked(
                mockSecurityUtil.compare,
            ).mockResolvedValue(false);

            await expect(
                service.resetPassword(
                    RECOVERY_EMAIL,
                    "user@example.com",
                    "wrong_code",
                    "newPass123",
                ),
            ).rejects.toMatchObject({
                statusCode: 400,
                errorCode: "INVALID_CODE",
            });

            expect(
                mockRecoveryRepo.updateTries,
            ).toHaveBeenCalledWith(
                99,
                0,
                expect.any(Date),
            );
        });

        it("should throw 404 if user account is not found during final step", async () => {
            vi.mocked(
                mockRecoveryRepo.findBySendTo,
            ).mockResolvedValue({
                id: 99,
                expired_at: new Date(Date.now() + 600000),
                next_try_at: null,
                code: "hashed_code",
                tries: 0,
            } as any);

            vi.mocked(
                mockSecurityUtil.compare,
            ).mockResolvedValue(true);

            vi.mocked(
                mockUserRepo.findByEmail,
            ).mockResolvedValue(null);

            await expect(
                service.resetPassword(
                    RECOVERY_EMAIL,
                    "user@example.com",
                    "123456",
                    "newPass123",
                ),
            ).rejects.toMatchObject({
                statusCode: 404,
                errorCode: "USER_NOT_FOUND",
            });

            expect(
                mockRecoveryRepo.deleteById,
            ).toHaveBeenCalledWith(99);

            expect(
                mockUserRepo.updatePassword,
            ).not.toHaveBeenCalled();
        });

        it("should reset password successfully and invalidate recovery session", async () => {
            vi.mocked(
                mockRecoveryRepo.findBySendTo,
            ).mockResolvedValue({
                id: 99,
                expired_at: new Date(Date.now() + 600000),
                next_try_at: null,
                code: "hashed_code",
                tries: 0,
            } as any);

            vi.mocked(
                mockSecurityUtil.compare,
            ).mockResolvedValue(true);

            vi.mocked(
                mockUserRepo.findByEmail,
            ).mockResolvedValue({
                id: 10,
            } as any);

            vi.mocked(
                mockSecurityUtil.hash,
            ).mockResolvedValue("hashed_new_password");

            await service.resetPassword(
                RECOVERY_EMAIL,
                "user@example.com",
                "123456",
                "newPass123",
            );

            expect(
                mockSecurityUtil.hash,
            ).toHaveBeenCalledWith("newPass123");

            expect(
                mockUserRepo.updatePassword,
            ).toHaveBeenCalledWith(
                10,
                "hashed_new_password",
            );

            expect(
                mockRecoveryRepo.deleteById,
            ).toHaveBeenCalledWith(99);
        });

        it("should throw 500 if recovery session cannot be invalidated after password update", async () => {
            vi.mocked(
                mockRecoveryRepo.findBySendTo,
            ).mockResolvedValue({
                id: 99,
                expired_at: new Date(Date.now() + 600000),
                next_try_at: null,
                code: "hashed_code",
                tries: 0,
            } as any);

            vi.mocked(
                mockSecurityUtil.compare,
            ).mockResolvedValue(true);

            vi.mocked(
                mockUserRepo.findByEmail,
            ).mockResolvedValue({
                id: 10,
            } as any);

            vi.mocked(
                mockSecurityUtil.hash,
            ).mockResolvedValue("hashed_new_password");

            vi.mocked(
                mockRecoveryRepo.deleteById,
            ).mockResolvedValue(false);

            await expect(
                service.resetPassword(
                    RECOVERY_EMAIL,
                    "user@example.com",
                    "123456",
                    "newPass123",
                ),
            ).rejects.toMatchObject({
                statusCode: 500,
                errorCode: "RECOVERY_COMPLETION_FAILED",
            });

            expect(
                mockUserRepo.updatePassword,
            ).toHaveBeenCalledWith(
                10,
                "hashed_new_password",
            );

            expect(
                mockRecoveryRepo.deleteById,
            ).toHaveBeenCalledWith(99);
        });
    });
});
