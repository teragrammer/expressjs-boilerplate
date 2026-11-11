import {beforeEach, describe, expect, it, vi} from "vitest";

import {AccountService} from "./account.service";
import {UserRepository} from "../user.repository";
import {SecurityUtil} from "../../../common/utils/security.util";
import {AuthenticationTokenRepository} from "../../auth/authentication/authentication-token.repository";
import {RoleService} from "../../system/roles/role.service";
import {DateUtil} from "../../../common/utils/date.util";
import {
    SecurityAccountDTO,
    UpdateUserDTO,
    User,
} from "../user.interface";
import {AuthenticationToken} from "../../auth/authentication/authentication.interface";
import Messages from "../../../common/utils/messages";
import {SessionService} from "../../auth/authentication/session.service";
import {VerificationService} from "../../auth/verification/verification.service";
import {PasswordRecoveryRepository} from "../../auth/password-recovery/password-recovery.repository";

describe("AccountService", () => {
    let service: AccountService;

    let mockUserRepository: {
        update: ReturnType<typeof vi.fn>;
        findAuthById: ReturnType<typeof vi.fn>;
    };

    let mockSecurityUtil: {
        compare: ReturnType<typeof vi.fn>;
        hash: ReturnType<typeof vi.fn>;
    };

    let mockAuthTokenRepository: {
        findById: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        deleteAllByUserId: ReturnType<typeof vi.fn>;
    };

    let mockRoleService: {
        findById: ReturnType<typeof vi.fn>;
    };

    let mockDateUtil: {
        expiredAt: ReturnType<typeof vi.fn>;
    };

    let mockSessionService: {
        issueForSession: ReturnType<typeof vi.fn>;
    };

    let mockVerificationService: {
        resetFlag: ReturnType<typeof vi.fn>;
        send: ReturnType<typeof vi.fn>;
    };

    let mockPasswordRecoveryRepository: {
        deleteAllByUserId: ReturnType<typeof vi.fn>;
    };

    let user: User;

    beforeEach(() => {
        mockUserRepository = {
            update: vi.fn(),
            findAuthById: vi.fn(),
        };

        mockSecurityUtil = {
            compare: vi.fn(),
            hash: vi.fn(),
        };

        mockAuthTokenRepository = {
            findById: vi.fn(),
            update: vi.fn(),
            create: vi.fn(),
            deleteAllByUserId: vi.fn(),
        };

        mockRoleService = {
            findById: vi.fn(),
        };

        mockDateUtil = {
            expiredAt: vi.fn(),
        };

        mockSessionService = {
            issueForSession: vi.fn().mockResolvedValue({
                accessToken: "new.jwt.token",
                refreshToken: "refresh.token",
                sessionId: 99,
                expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            }),
        };

        mockVerificationService = {
            resetFlag: vi.fn(),
            send: vi.fn(),
        };

        mockPasswordRecoveryRepository = {
            deleteAllByUserId: vi.fn(),
        };

        service = new AccountService(
            mockUserRepository as unknown as UserRepository,
            mockSecurityUtil as unknown as SecurityUtil,
            mockAuthTokenRepository as unknown as AuthenticationTokenRepository,
            mockRoleService as unknown as RoleService,
            mockDateUtil as unknown as DateUtil,
            mockSessionService as unknown as SessionService,
            mockVerificationService as unknown as VerificationService,
            mockPasswordRecoveryRepository as unknown as PasswordRecoveryRepository,
        );

        user = {
            id: 1,
            first_name: "John",
            middle_name: null,
            last_name: "Doe",
            gender: null,
            address: "123 Main Street",
            phone: "+1234567890",
            is_phone_verified: true,
            email: "john@example.com",
            is_email_verified: true,
            has_tfa: false,
            tfa_secret: null,
            role_id: 1,
            username: "johndoe",
            password: "$2b$10$hashed-password",
            status: "Activated",
            login_tries: 0,
            failed_login_expired_at: null,
            comments: null,
            authorization_version: 0,
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
        };
    });

    describe("information()", () => {
        const currentTid = 45;

        it("should update the profile and issue a token bound to the current session", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                middle_name: "Michael",
                last_name: "Smith",
                address: "456 New Street",
            };

            const updatedUser: User = {
                ...user,
                first_name: "Jane",
                middle_name: "Michael",
                last_name: "Smith",
                address: "456 New Street",
            };

            const role = {
                id: 1,
                slug: "customer",
                is_bypass_authorization: false,
                created_at: new Date(),
                updated_at: new Date(),
            };

            const newExpiredAt = new Date(Date.now() + 86400000 * 7);

            mockUserRepository.findAuthById.mockResolvedValue(user);
            mockUserRepository.update.mockResolvedValue(updatedUser);
            mockAuthTokenRepository.update.mockResolvedValue({
                expired_at: newExpiredAt,
            });
            mockDateUtil.expiredAt.mockReturnValue(newExpiredAt);
            mockRoleService.findById.mockResolvedValue(role);

            const result = await service.information(1, data, currentTid);

            expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                1,
                data,
                "Activated",
            );

            // The current session is refreshed, never replaced.
            expect(mockAuthTokenRepository.update).toHaveBeenCalledWith(
                currentTid,
                {expired_at: newExpiredAt},
            );
            expect(mockRoleService.findById).toHaveBeenCalledWith(
                user.role_id,
            );

            // The token references the real session id (no `tid: 0`).
            expect(mockSessionService.issueForSession).toHaveBeenCalledTimes(1);
            expect(mockSessionService.issueForSession).toHaveBeenCalledWith(
                currentTid,
                updatedUser,
                role,
                false,
            );

            expect(result).toBe("new.jwt.token");
        });

        it("should throw a server error when the user cannot be updated", async () => {
            mockUserRepository.update.mockResolvedValue(null);

            await expect(
                service.information(1, {first_name: "Jane"}, currentTid),
            ).rejects.toMatchObject({
                errorCode: Messages.SERVER_ERROR.code,
            });

            expect(mockSessionService.issueForSession).not.toHaveBeenCalled();
        });

        it("should reset the verification flag when the email changes", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
                email: "new@example.com",
            };

            mockUserRepository.findAuthById.mockResolvedValue(user);
            mockUserRepository.update.mockResolvedValue({
                ...user,
                email: "new@example.com",
            });
            mockRoleService.findById.mockResolvedValue({
                slug: "customer",
                is_bypass_authorization: false,
            });

            await service.information(1, data, currentTid);

            expect(mockVerificationService.resetFlag).toHaveBeenCalledWith(
                user.id,
                "email",
            );
            expect(mockVerificationService.send).toHaveBeenCalledWith(
                user.id,
                "email",
                "new@example.com",
            );
        });

        it("should reset the verification flag when the phone changes", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
                phone: "+19998887777",
            };

            mockUserRepository.findAuthById.mockResolvedValue(user);
            mockUserRepository.update.mockResolvedValue({
                ...user,
                phone: "+19998887777",
            });
            mockRoleService.findById.mockResolvedValue({
                slug: "customer",
                is_bypass_authorization: false,
            });

            await service.information(1, data, currentTid);

            expect(mockVerificationService.resetFlag).toHaveBeenCalledWith(
                user.id,
                "phone",
            );
            expect(mockVerificationService.send).toHaveBeenCalledWith(
                user.id,
                "phone",
                "+19998887777",
            );
        });

        it("should not touch verification flags when the contact is unchanged", async () => {
            mockUserRepository.findAuthById.mockResolvedValue(user);
            mockUserRepository.update.mockResolvedValue(user);
            mockRoleService.findById.mockResolvedValue({
                slug: "customer",
                is_bypass_authorization: false,
            });

            await service.information(
                1,
                {first_name: "Jane", last_name: "Smith"},
                currentTid,
            );

            expect(mockVerificationService.resetFlag).not.toHaveBeenCalled();
            expect(mockVerificationService.send).not.toHaveBeenCalled();
        });
    });

    describe("password()", () => {
        const currentTid = 45;

        it("should reject when the current password does not match", async () => {
            const data: SecurityAccountDTO = {
                current_password: "wrong",
                new_password: "NewPassword123!",
            };

            mockSecurityUtil.compare.mockResolvedValue(false);

            await expect(
                service.password(user, data, currentTid),
            ).rejects.toMatchObject({
                errorCode: Messages.CREDENTIAL_DO_NOT_MATCH.code,
            });

            expect(mockUserRepository.update).not.toHaveBeenCalled();
        });

        it("should rotate the session, revoke the others and invalidate recovery codes", async () => {
            const data: SecurityAccountDTO = {
                current_password: "OldPassword123!",
                new_password: "NewPassword123!",
            };

            const newSession = {
                id: 99,
                user_id: user.id,
                expired_at: new Date(Date.now() + 86400000),
            };

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockResolvedValue("hashed-new-password");
            mockUserRepository.update.mockResolvedValue(user);
            mockAuthTokenRepository.create.mockResolvedValue(newSession);
            mockRoleService.findById.mockResolvedValue({
                slug: "customer",
                is_bypass_authorization: false,
            });

            const result = await service.password(user, data, currentTid);

            expect(mockSecurityUtil.hash).toHaveBeenCalledWith(
                "NewPassword123!",
            );

            // Outstanding recovery codes are invalidated.
            expect(
                mockPasswordRecoveryRepository.deleteAllByUserId,
            ).toHaveBeenCalledWith(user.id);

            // A new session is created and every other session revoked.
            expect(mockAuthTokenRepository.create).toHaveBeenCalledTimes(1);
            expect(mockAuthTokenRepository.deleteAllByUserId).toHaveBeenCalledWith(
                user.id,
                newSession.id,
            );

            expect(mockSessionService.issueForSession).toHaveBeenCalledWith(
                newSession.id,
                expect.objectContaining({id: user.id}),
                expect.objectContaining({slug: "customer"}),
                false,
                {includeRefreshToken: true},
            );

            expect(result).toBe("new.jwt.token");
        });

        it("should throw when the user update fails", async () => {
            const data: SecurityAccountDTO = {
                current_password: "OldPassword123!",
            };

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(null);

            await expect(
                service.password(user, data, currentTid),
            ).rejects.toMatchObject({
                errorCode: Messages.UPDATE_FAILED.code,
            });
        });
    });
});
