import {beforeEach, describe, expect, it, vi} from "vitest";

import {UserRepository} from "../user.repository";
import {
    BrowseUsersQuery,
    BrowseUsersResult,
    CreateUserDTO,
    UpdateUserDTO,
    User,
} from "../user.interface";
import {SecurityUtil} from "../../../common/utils/security.util";
import Messages from "../../../common/utils/messages";
import {UserService} from "./user.service";

describe("UserService", () => {
    let service: UserService;
    let userRepository: {
        findByEmail: ReturnType<typeof vi.fn>;
        findByPhone: ReturnType<typeof vi.fn>;
        create: ReturnType<typeof vi.fn>;
        update: ReturnType<typeof vi.fn>;
        browse: ReturnType<typeof vi.fn>;
        findById: ReturnType<typeof vi.fn>;
        findAuthById: ReturnType<typeof vi.fn>;
        softDelete: ReturnType<typeof vi.fn>;
        hardDelete: ReturnType<typeof vi.fn>;
    };
    let securityUtil: {
        hash: ReturnType<typeof vi.fn>;
    };

    const mockUser: User = {
        id: 42,
        first_name: "John",
        middle_name: null,
        last_name: "Doe",
        gender: "Male",
        address: "123 Main Street",
        phone: "1234567890",
        is_phone_verified: false,
        email: "john@example.com",
        is_email_verified: false,
        has_tfa: false,
        role_id: 1,
        username: "johndoe",
        status: "Activated",
        comments: null,
        tfa_secret: null,
        login_tries: 0,
        failed_login_expired_at: null,
        authorization_version: 0,
        deleted_at: null,
        created_at: new Date(),
        updated_at: new Date(),
    };

    const createUserData: CreateUserDTO = {
        first_name: "John",
        middle_name: null,
        last_name: "Doe",
        gender: "Male",
        address: "123 Main Street",
        phone: "1234567890",
        email: "john@example.com",
        role_id: 1,
        username: "johndoe",
        password: "Password123!",
        status: "Activated",
        comments: null,
    };

    const updateUserData: UpdateUserDTO = {
        first_name: "Updated",
        last_name: "User",
        email: "updated@example.com",
    };

    const browseResult: BrowseUsersResult = {
        data: [mockUser],
        hasMore: false,
        nextCursor: null,
    };

    beforeEach(() => {
        userRepository = {
            findByEmail: vi.fn(),
            findByPhone: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            browse: vi.fn(),
            findById: vi.fn(),
            findAuthById: vi.fn(),
            softDelete: vi.fn(),
            hardDelete: vi.fn(),
        };

        securityUtil = {
            hash: vi.fn(),
        };

        service = new UserService(
            userRepository as unknown as UserRepository,
            securityUtil as unknown as SecurityUtil,
        );

        // Default mock for findAuthById to return the mockUser
        userRepository.findAuthById.mockResolvedValue(mockUser);
    });

    describe("registerUser()", () => {
        it("should create a user when email and phone are unique", async () => {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.findByPhone.mockResolvedValue(null);
            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.registerUser({
                ...createUserData,
            });

            expect(result).toEqual(mockUser);

            expect(userRepository.findByEmail).toHaveBeenCalledWith(
                createUserData.email,
            );
            expect(userRepository.findByPhone).toHaveBeenCalledWith(
                createUserData.phone,
            );
            expect(userRepository.create).toHaveBeenCalledWith(
                createUserData,
                undefined,
            );
        });

        it("should create a user without checking email when email is not provided", async () => {
            const data = {
                ...createUserData,
                email: undefined,
            };

            userRepository.findByPhone.mockResolvedValue(null);
            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.registerUser(data);

            expect(result).toEqual(mockUser);
            expect(userRepository.findByEmail).not.toHaveBeenCalled();
            expect(userRepository.findByPhone).toHaveBeenCalledWith(
                data.phone,
            );
            expect(userRepository.create).toHaveBeenCalledWith(data, undefined);
        });

        it("should create a user without checking phone when phone is not provided", async () => {
            const data = {
                ...createUserData,
                phone: undefined,
            };

            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.registerUser(data);

            expect(result).toEqual(mockUser);
            expect(userRepository.findByEmail).toHaveBeenCalledWith(
                data.email,
            );
            expect(userRepository.findByPhone).not.toHaveBeenCalled();
            expect(userRepository.create).toHaveBeenCalledWith(data, undefined);
        });

        it("should create a user without checking email or phone when neither is provided", async () => {
            const data = {
                ...createUserData,
                email: undefined,
                phone: undefined,
            };

            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.registerUser(data);

            expect(result).toEqual(mockUser);
            expect(userRepository.findByEmail).not.toHaveBeenCalled();
            expect(userRepository.findByPhone).not.toHaveBeenCalled();
            expect(userRepository.create).toHaveBeenCalledWith(data, undefined);
        });

        it("should throw a duplicate error when email already exists", async () => {
            const data = {
                ...createUserData,
                email: "existing@example.com",
            };

            userRepository.findByEmail.mockResolvedValue(mockUser);

            await expect(
                service.registerUser(data),
            ).rejects.toMatchObject({
                message: "Duplicate email already exists",
                errorCode: Messages.DUPLICATE_DATA.code,
                statusCode: 409,
            });

            expect(userRepository.findByEmail).toHaveBeenCalledWith(
                data.email,
            );
            expect(userRepository.findByPhone).not.toHaveBeenCalled();
            expect(userRepository.create).not.toHaveBeenCalled();
        });

        it("should throw a duplicate error when phone already exists", async () => {
            const data = {
                ...createUserData,
                phone: "9999999999",
            };

            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.findByPhone.mockResolvedValue(mockUser);

            await expect(
                service.registerUser(data),
            ).rejects.toMatchObject({
                message: "Duplicate phone number already exists",
                errorCode: Messages.DUPLICATE_DATA.code,
                statusCode: 409,
            });

            expect(userRepository.findByEmail).toHaveBeenCalledWith(
                data.email,
            );
            expect(userRepository.findByPhone).toHaveBeenCalledWith(
                data.phone,
            );
            expect(userRepository.create).not.toHaveBeenCalled();
        });

        it("should not check phone when email is already duplicated", async () => {
            userRepository.findByEmail.mockResolvedValue(mockUser);

            await expect(
                service.registerUser({...createUserData}),
            ).rejects.toMatchObject({
                errorCode: Messages.DUPLICATE_DATA.code,
                statusCode: 409,
            });

            expect(userRepository.findByPhone).not.toHaveBeenCalled();
            expect(userRepository.create).not.toHaveBeenCalled();
        });

        it("should propagate repository create errors", async () => {
            const error = new Error("Database error");

            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.findByPhone.mockResolvedValue(null);
            userRepository.create.mockRejectedValue(error);

            await expect(
                service.registerUser({...createUserData}),
            ).rejects.toThrow("Database error");
        });
    });

    describe("createUser()", () => {
        it("should hash the password before creating the user", async () => {
            const data = {
                ...createUserData,
                password: "PlainPassword123!",
            };

            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.createUser(data);

            expect(result).toEqual(mockUser);
            expect(securityUtil.hash).toHaveBeenCalledWith(
                "PlainPassword123!",
            );
            expect(userRepository.create).toHaveBeenCalledWith({
                ...data,
                password: "hashed-password",
            });
        });

        it("should not hash the password when password is null", async () => {
            const data = {
                ...createUserData,
                password: null,
            };

            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.createUser(data);

            expect(result).toEqual(mockUser);
            expect(securityUtil.hash).not.toHaveBeenCalled();
            expect(userRepository.create).toHaveBeenCalledWith(data);
        });

        it("should not hash the password when password is undefined", async () => {
            const data = {
                ...createUserData,
                password: undefined,
            };

            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.createUser(data);

            expect(result).toEqual(mockUser);
            expect(securityUtil.hash).not.toHaveBeenCalled();
            expect(userRepository.create).toHaveBeenCalledWith(data);
        });

        it("should return the created user", async () => {
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockResolvedValue(mockUser);

            const result = await service.createUser({
                ...createUserData,
            });

            expect(result).toEqual(mockUser);
        });

        it("should throw a server error when repository returns null", async () => {
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockResolvedValue(null);

            await expect(
                service.createUser({...createUserData}),
            ).rejects.toMatchObject({
                message: Messages.SERVER_ERROR.message,
                errorCode: Messages.SERVER_ERROR.code,
                statusCode: 500,
            });

            expect(userRepository.create).toHaveBeenCalledTimes(1);
        });

        it("should propagate password hashing errors", async () => {
            const error = new Error("Hashing failed");

            securityUtil.hash.mockRejectedValue(error);

            await expect(
                service.createUser({...createUserData}),
            ).rejects.toThrow("Hashing failed");

            expect(userRepository.create).not.toHaveBeenCalled();
        });

        it("should propagate repository errors", async () => {
            const error = new Error("Database error");

            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockRejectedValue(error);

            await expect(
                service.createUser({...createUserData}),
            ).rejects.toThrow("Database error");
        });
    });

    describe("updateUser()", () => {
        it("should hash the password before updating the user", async () => {
            const data: UpdateUserDTO = {
                ...updateUserData,
                password: "PlainPassword123!",
            };

            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.update.mockResolvedValue(mockUser);

            const result = await service.updateUser(42, data);

            expect(result).toEqual(mockUser);
            expect(securityUtil.hash).toHaveBeenCalledWith(
                "PlainPassword123!",
            );
            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
            expect(userRepository.update).toHaveBeenCalledWith(
                42,
                {
                    ...data,
                    password: "hashed-password",
                },
            );
        });

        it("should not hash the password when password is null", async () => {
            const data: UpdateUserDTO = {
                ...updateUserData,
                password: null,
            };

            userRepository.update.mockResolvedValue(mockUser);

            const result = await service.updateUser(42, data);

            expect(result).toEqual(mockUser);
            expect(securityUtil.hash).not.toHaveBeenCalled();
            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
            expect(userRepository.update).toHaveBeenCalledWith(42, data);
        });

        it("should not hash the password when password is undefined", async () => {
            const data: UpdateUserDTO = {
                ...updateUserData,
                password: undefined,
            };

            userRepository.update.mockResolvedValue(mockUser);

            const result = await service.updateUser(42, data);

            expect(result).toEqual(mockUser);
            expect(securityUtil.hash).not.toHaveBeenCalled();
            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
            expect(userRepository.update).toHaveBeenCalledWith(42, data);
        });

        it("should return the updated user", async () => {
            userRepository.update.mockResolvedValue(mockUser);

            const result = await service.updateUser(
                42,
                {...updateUserData},
            );

            expect(result).toEqual(mockUser);
            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
        });

        it("should throw a server error when repository returns null", async () => {
            userRepository.update.mockResolvedValue(null);

            await expect(
                service.updateUser(42, {...updateUserData}),
            ).rejects.toMatchObject({
                message: Messages.DATA_NOT_FOUND.message,
                errorCode: Messages.DATA_NOT_FOUND.code,
                statusCode: 404,
            });

            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
            expect(userRepository.update).toHaveBeenCalledWith(
                42,
                updateUserData,
            );
        });

        it("should propagate password hashing errors", async () => {
            const error = new Error("Hashing failed");

            securityUtil.hash.mockRejectedValue(error);

            await expect(
                service.updateUser(42, {
                    ...updateUserData,
                    password: "Password123!",
                }),
            ).rejects.toThrow("Hashing failed");

            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
            expect(userRepository.update).not.toHaveBeenCalled();
        });

        it("should propagate repository errors", async () => {
            const error = new Error("Database error");

            userRepository.update.mockRejectedValue(error);

            await expect(
                service.updateUser(42, {...updateUserData}),
            ).rejects.toThrow("Database error");

            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
        });

        it("should increment authorization_version when role_id changes", async () => {
            const data: UpdateUserDTO = {
                ...updateUserData,
                role_id: 2,
            };

            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.update.mockResolvedValue({...mockUser, role_id: 2, authorization_version: 1});

            const result = await service.updateUser(42, data);

            expect(result).toEqual(expect.objectContaining({role_id: 2, authorization_version: 1}));
            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
            expect(userRepository.update).toHaveBeenCalledWith(
                42,
                expect.objectContaining({
                    role_id: 2,
                    authorization_version: 1,
                }),
            );
        });

        it("should increment authorization_version when status changes", async () => {
            const data: UpdateUserDTO = {
                ...updateUserData,
                status: "Suspended",
            };

            userRepository.update.mockResolvedValue({...mockUser, status: "Suspended", authorization_version: 1});

            const result = await service.updateUser(42, data);

            expect(result).toEqual(expect.objectContaining({status: "Suspended", authorization_version: 1}));
            expect(userRepository.findAuthById).toHaveBeenCalledWith(42);
            expect(userRepository.update).toHaveBeenCalledWith(
                42,
                expect.objectContaining({
                    status: "Suspended",
                    authorization_version: 1,
                }),
            );
        });
    });

    describe("browseUsers()", () => {
        it("should return users from the repository", async () => {
            const query: BrowseUsersQuery = {
                role_id: 1,
                status: "Activated",
                search: "john",
                cursor: 100,
                limit: 20,
            };

            userRepository.browse.mockResolvedValue(browseResult);

            const result = await service.browseUsers(query);

            expect(result).toEqual(browseResult);
            expect(userRepository.browse).toHaveBeenCalledWith(query);
        });

        it("should support browsing without filters", async () => {
            const query: BrowseUsersQuery = {
                cursor: undefined,
                limit: 20,
            };

            userRepository.browse.mockResolvedValue(browseResult);

            const result = await service.browseUsers(query);

            expect(result).toEqual(browseResult);
            expect(userRepository.browse).toHaveBeenCalledWith(query);
        });

        it("should return an empty result when repository returns no users", async () => {
            const result: BrowseUsersResult = {
                data: [],
                hasMore: false,
                nextCursor: null,
            };

            userRepository.browse.mockResolvedValue(result);

            const query: BrowseUsersQuery = {
                limit: 20,
            };

            await expect(
                service.browseUsers(query),
            ).resolves.toEqual(result);

            expect(userRepository.browse).toHaveBeenCalledWith(query);
        });

        it("should propagate repository errors", async () => {
            const error = new Error("Database error");

            userRepository.browse.mockRejectedValue(error);

            await expect(
                service.browseUsers({
                    limit: 20,
                }),
            ).rejects.toThrow("Database error");
        });
    });

    describe("findById()", () => {
        it("should return the user when found", async () => {
            userRepository.findById.mockResolvedValue(mockUser);

            const result = await service.findById(42);

            expect(result).toEqual(mockUser);
            expect(userRepository.findById).toHaveBeenCalledWith(42);
        });

        it("should throw a not-found AppError when user does not exist", async () => {
            userRepository.findById.mockResolvedValue(null);

            await expect(
                service.findById(42),
            ).rejects.toMatchObject({
                message: Messages.DATA_NOT_FOUND.message,
                errorCode: Messages.DATA_NOT_FOUND.code,
                statusCode: 404,
            });

            expect(userRepository.findById).toHaveBeenCalledWith(42);
        });

        it("should propagate repository errors", async () => {
            const error = new Error("Database error");

            userRepository.findById.mockRejectedValue(error);

            await expect(
                service.findById(42),
            ).rejects.toThrow("Database error");
        });
    });

    describe("hardDelete()", () => {
        it("should delete the user successfully", async () => {
            userRepository.hardDelete.mockResolvedValue(true);

            await expect(
                service.hardDelete(42),
            ).resolves.toBeUndefined();

            expect(userRepository.hardDelete).toHaveBeenCalledWith(42);
        });

        it("should throw a delete-failed AppError when repository returns false", async () => {
            userRepository.hardDelete.mockResolvedValue(false);

            await expect(
                service.hardDelete(42),
            ).rejects.toMatchObject({
                message: Messages.DELETE_FAILED.message,
                errorCode: Messages.DELETE_FAILED.code,
                statusCode: 500,
            });

            expect(userRepository.hardDelete).toHaveBeenCalledWith(42);
        });

        it("should propagate repository errors", async () => {
            const error = new Error("Database error");

            userRepository.hardDelete.mockRejectedValue(error);

            await expect(
                service.hardDelete(42),
            ).rejects.toThrow("Database error");
        });
    });
});