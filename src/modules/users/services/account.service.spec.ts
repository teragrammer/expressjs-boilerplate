import {beforeEach, describe, expect, it, vi} from "vitest";

import {AccountService} from "./account.service";
import {UserRepository} from "../user.repository";
import {TokenService} from "../../auth/services/authentication-token.service";
import {SecurityUtil} from "../../../common/utils/security.util";
import {
    SecurityAccountDTO,
    UpdateUserDTO,
    User,
} from "../user.interface";
import Messages from "../../../common/utils/messages";

describe("AccountService", () => {
    let service: AccountService;

    let mockUserRepository: {
        update: ReturnType<typeof vi.fn>;
    };

    let mockTokenService: {
        generateToken: ReturnType<typeof vi.fn>;
    };

    let mockSecurityUtil: {
        compare: ReturnType<typeof vi.fn>;
        hash: ReturnType<typeof vi.fn>;
    };

    let user: User;

    beforeEach(() => {
        vi.clearAllMocks();

        mockUserRepository = {
            update: vi.fn(),
        };

        mockTokenService = {
            generateToken: vi.fn(),
        };

        mockSecurityUtil = {
            compare: vi.fn(),
            hash: vi.fn(),
        };

        service = new AccountService(
            mockUserRepository as unknown as UserRepository,
            mockTokenService as unknown as TokenService,
            mockSecurityUtil as unknown as SecurityUtil,
        );

        // Create a fresh user for every test because password()
        // mutates username, email and phone when they are supplied.
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
            created_at: new Date(),
            updated_at: new Date(),
            deleted_at: null,
        };
    });

    describe("information()", () => {
        it("should update account information and return a generated token", async () => {
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

            mockUserRepository.update.mockResolvedValue(updatedUser);
            mockTokenService.generateToken.mockReturnValue(
                "mocked-jwt-token",
            );

            const result = await service.information(1, data);

            expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                1,
                data,
                "Activated",
            );

            expect(mockTokenService.generateToken).toHaveBeenCalledTimes(1);
            expect(mockTokenService.generateToken).toHaveBeenCalledWith({
                uid: updatedUser.id,
                tid: 0,
                tfa: false,
            });

            expect(result).toBe("mocked-jwt-token");
        });

        it("should use the ID returned by the updated user when generating the token", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
            };

            const updatedUser: User = {
                ...user,
                id: 42,
            };

            mockUserRepository.update.mockResolvedValue(updatedUser);
            mockTokenService.generateToken.mockReturnValue("new-token");

            const result = await service.information(1, data);

            expect(mockUserRepository.update).toHaveBeenCalledWith(
                1,
                data,
                "Activated",
            );

            expect(mockTokenService.generateToken).toHaveBeenCalledWith({
                uid: 42,
                tid: 0,
                tfa: false,
            });

            expect(result).toBe("new-token");
        });

        it("should throw a server error when the user update returns null", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
            };

            mockUserRepository.update.mockResolvedValue(null);

            await expect(
                service.information(1, data),
            ).rejects.toMatchObject({
                message: Messages.SERVER_ERROR.message,
                errorCode: Messages.SERVER_ERROR.code,
                statusCode: 500,
            });

            expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                1,
                data,
                "Activated",
            );

            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should throw a server error when the user update returns undefined", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
            };

            mockUserRepository.update.mockResolvedValue(undefined);

            await expect(
                service.information(1, data),
            ).rejects.toMatchObject({
                message: Messages.SERVER_ERROR.message,
                errorCode: Messages.SERVER_ERROR.code,
                statusCode: 500,
            });

            expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                1,
                data,
                "Activated",
            );

            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should propagate a repository error", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
            };

            const repositoryError = new Error(
                "Database connection failed",
            );

            mockUserRepository.update.mockRejectedValue(repositoryError);

            await expect(
                service.information(1, data),
            ).rejects.toBe(repositoryError);

            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should propagate a token generation error", async () => {
            const data: UpdateUserDTO = {
                first_name: "Jane",
                last_name: "Smith",
            };

            const tokenError = new Error(
                "Token generation failed",
            );

            mockUserRepository.update.mockResolvedValue(user);
            mockTokenService.generateToken.mockImplementation(() => {
                throw tokenError;
            });

            await expect(
                service.information(1, data),
            ).rejects.toBe(tokenError);

            expect(mockUserRepository.update).toHaveBeenCalledWith(
                1,
                data,
                "Activated",
            );

            expect(mockTokenService.generateToken).toHaveBeenCalledWith({
                uid: user.id,
                tid: 0,
                tfa: false,
            });
        });
    });

    describe("password()", () => {
        it("should verify the current password, hash the new password, update the user and return a token", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockResolvedValue(
                "hashed-new-password",
            );
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue(
                "password-update-token",
            );

            const result = await service.password(user, data);

            expect(mockSecurityUtil.compare).toHaveBeenCalledTimes(1);
            expect(mockSecurityUtil.compare).toHaveBeenCalledWith(
                user.password,
                data.current_password,
            );

            expect(mockSecurityUtil.hash).toHaveBeenCalledTimes(1);
            expect(mockSecurityUtil.hash).toHaveBeenCalledWith(
                data.new_password,
            );

            expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
            expect(mockUserRepository.update).toHaveBeenCalledWith(
                user.id,
                expect.objectContaining({
                    current_password: data.current_password,
                    new_password: data.new_password,
                    password: "hashed-new-password",
                }),
                "Activated",
            );

            expect(mockTokenService.generateToken).toHaveBeenCalledTimes(1);
            expect(mockTokenService.generateToken).toHaveBeenCalledWith({
                uid: user.id,
                tid: 0,
                tfa: false,
            });

            expect(result).toBe("password-update-token");
        });

        it("should reject when the user has no password", async () => {
            const userWithoutPassword: User = {
                ...user,
                password: null,
            };

            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            await expect(
                service.password(userWithoutPassword, data),
            ).rejects.toMatchObject({
                message: Messages.CREDENTIAL_DO_NOT_MATCH.message,
                errorCode: Messages.CREDENTIAL_DO_NOT_MATCH.code,
                statusCode: 401,
            });

            expect(mockSecurityUtil.compare).not.toHaveBeenCalled();
            expect(mockSecurityUtil.hash).not.toHaveBeenCalled();
            expect(mockUserRepository.update).not.toHaveBeenCalled();
            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should reject when the current password does not match", async () => {
            const data: SecurityAccountDTO = {
                current_password: "WrongPassword123!",
                new_password: "NewPassword123!",
            };

            mockSecurityUtil.compare.mockResolvedValue(false);

            await expect(
                service.password(user, data),
            ).rejects.toMatchObject({
                message: Messages.CREDENTIAL_DO_NOT_MATCH.message,
                errorCode: Messages.CREDENTIAL_DO_NOT_MATCH.code,
                statusCode: 401,
            });

            expect(mockSecurityUtil.compare).toHaveBeenCalledTimes(1);
            expect(mockSecurityUtil.compare).toHaveBeenCalledWith(
                user.password,
                data.current_password,
            );

            expect(mockSecurityUtil.hash).not.toHaveBeenCalled();
            expect(mockUserRepository.update).not.toHaveBeenCalled();
            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should propagate an error thrown by password comparison", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            const compareError = new Error(
                "Password comparison failed",
            );

            mockSecurityUtil.compare.mockRejectedValue(compareError);

            await expect(
                service.password(user, data),
            ).rejects.toBe(compareError);

            expect(mockSecurityUtil.hash).not.toHaveBeenCalled();
            expect(mockUserRepository.update).not.toHaveBeenCalled();
            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should hash the new password when new_password is provided", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockResolvedValue(
                "hashed-new-password",
            );
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            await service.password(user, data);

            expect(mockSecurityUtil.hash).toHaveBeenCalledTimes(1);
            expect(mockSecurityUtil.hash).toHaveBeenCalledWith(
                "NewPassword123!",
            );

            expect(mockUserRepository.update).toHaveBeenCalledWith(
                user.id,
                expect.objectContaining({
                    password: "hashed-new-password",
                }),
                "Activated",
            );
        });

        it("should not hash when new_password is undefined", async () => {
            const data = {
                current_password: "CurrentPassword123!",
            } as SecurityAccountDTO;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            const result = await service.password(user, data);

            expect(mockSecurityUtil.hash).not.toHaveBeenCalled();

            expect(mockUserRepository.update).toHaveBeenCalledWith(
                user.id,
                data,
                "Activated",
            );

            expect(result).toBe("token");
        });

        it("should not hash when new_password is null", async () => {
            const data = {
                current_password: "CurrentPassword123!",
                new_password: null,
            } as unknown as SecurityAccountDTO;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            const result = await service.password(user, data);

            expect(mockSecurityUtil.hash).not.toHaveBeenCalled();

            expect(mockUserRepository.update).toHaveBeenCalledWith(
                user.id,
                data,
                "Activated",
            );

            expect(result).toBe("token");
        });

        it("should update only the supplied security fields", async () => {
            const data = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
                username: "newusername",
            } as SecurityAccountDTO;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockResolvedValue(
                "hashed-new-password",
            );
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            await service.password(user, data);

            expect(mockUserRepository.update).toHaveBeenCalledWith(
                user.id,
                expect.objectContaining({
                    current_password: data.current_password,
                    new_password: data.new_password,
                    username: "newusername",
                    password: "hashed-new-password",
                }),
                "Activated",
            );

            expect(user.username).toBe("newusername");
            expect(user.email).toBe("john@example.com");
            expect(user.phone).toBe("+1234567890");
        });

        it("should update the username on the user object when username is provided", async () => {
            const data = {
                current_password: "CurrentPassword123!",
                username: "updatedusername",
            } as SecurityAccountDTO;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            const result = await service.password(user, data);

            expect(user.username).toBe("updatedusername");
            expect(user.email).toBe("john@example.com");
            expect(user.phone).toBe("+1234567890");

            expect(result).toBe("token");
        });

        it("should update the email on the user object when email is provided", async () => {
            const data = {
                current_password: "CurrentPassword123!",
                email: "updated@example.com",
            } as SecurityAccountDTO;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            const result = await service.password(user, data);

            expect(user.email).toBe("updated@example.com");
            expect(user.username).toBe("johndoe");
            expect(user.phone).toBe("+1234567890");

            expect(result).toBe("token");
        });

        it("should update the phone on the user object when phone is provided", async () => {
            const data = {
                current_password: "CurrentPassword123!",
                phone: "+1111111111",
            } as SecurityAccountDTO;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            const result = await service.password(user, data);

            expect(user.phone).toBe("+1111111111");
            expect(user.username).toBe("johndoe");
            expect(user.email).toBe("john@example.com");

            expect(result).toBe("token");
        });

        it("should update username, email and phone when all are provided", async () => {
            const data = {
                current_password: "CurrentPassword123!",
                username: "updatedusername",
                email: "updated@example.com",
                phone: "+1111111111",
            } as SecurityAccountDTO;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue("token");

            await service.password(user, data);

            expect(user.username).toBe("updatedusername");
            expect(user.email).toBe("updated@example.com");
            expect(user.phone).toBe("+1111111111");
        });

        it("should throw an update failed error when the repository update returns null", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockResolvedValue(
                "hashed-new-password",
            );
            mockUserRepository.update.mockResolvedValue(null);

            await expect(
                service.password(user, data),
            ).rejects.toMatchObject({
                message: Messages.UPDATE_FAILED.message,
                errorCode: Messages.UPDATE_FAILED.code,
                statusCode: 500,
            });

            expect(mockSecurityUtil.compare).toHaveBeenCalledWith(
                user.password,
                data.current_password,
            );

            expect(mockSecurityUtil.hash).toHaveBeenCalledWith(
                data.new_password,
            );

            expect(mockUserRepository.update).toHaveBeenCalledWith(
                user.id,
                expect.objectContaining({
                    password: "hashed-new-password",
                }),
                "Activated",
            );

            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should throw an update failed error when the repository update returns undefined", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockResolvedValue(
                "hashed-new-password",
            );
            mockUserRepository.update.mockResolvedValue(undefined);

            await expect(
                service.password(user, data),
            ).rejects.toMatchObject({
                message: Messages.UPDATE_FAILED.message,
                errorCode: Messages.UPDATE_FAILED.code,
                statusCode: 500,
            });

            expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should propagate a repository update error", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            const repositoryError = new Error(
                "Database update failed",
            );

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockResolvedValue(
                "hashed-new-password",
            );
            mockUserRepository.update.mockRejectedValue(repositoryError);

            await expect(
                service.password(user, data),
            ).rejects.toBe(repositoryError);

            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should propagate an error thrown while hashing the new password", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
                new_password: "NewPassword123!",
            };

            const hashError = new Error(
                "Password hashing failed",
            );

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockSecurityUtil.hash.mockRejectedValue(hashError);

            await expect(
                service.password(user, data),
            ).rejects.toBe(hashError);

            expect(mockUserRepository.update).not.toHaveBeenCalled();
            expect(mockTokenService.generateToken).not.toHaveBeenCalled();
        });

        it("should generate the token using the authenticated user's ID", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
            };

            user.id = 99;

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockReturnValue(
                "authenticated-token",
            );

            const result = await service.password(user, data);

            expect(mockTokenService.generateToken).toHaveBeenCalledWith({
                uid: 99,
                tid: 0,
                tfa: false,
            });

            expect(result).toBe("authenticated-token");
        });

        it("should propagate a token generation error", async () => {
            const data: SecurityAccountDTO = {
                current_password: "CurrentPassword123!",
            };

            const tokenError = new Error(
                "Token generation failed",
            );

            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(true);
            mockTokenService.generateToken.mockImplementation(() => {
                throw tokenError;
            });

            await expect(
                service.password(user, data),
            ).rejects.toBe(tokenError);

            expect(mockTokenService.generateToken).toHaveBeenCalledWith({
                uid: user.id,
                tid: 0,
                tfa: false,
            });
        });
    });
});
