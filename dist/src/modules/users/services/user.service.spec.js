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
const vitest_1 = require("vitest");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const user_service_1 = require("./user.service");
(0, vitest_1.describe)("UserService", () => {
    let service;
    let userRepository;
    let securityUtil;
    const mockUser = {
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
    const createUserData = {
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
    const updateUserData = {
        first_name: "Updated",
        last_name: "User",
        email: "updated@example.com",
    };
    const browseResult = {
        data: [mockUser],
        hasMore: false,
        nextCursor: null,
    };
    (0, vitest_1.beforeEach)(() => {
        userRepository = {
            findByEmail: vitest_1.vi.fn(),
            findByPhone: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            browse: vitest_1.vi.fn(),
            findById: vitest_1.vi.fn(),
            findAuthById: vitest_1.vi.fn(),
            softDelete: vitest_1.vi.fn(),
            hardDelete: vitest_1.vi.fn(),
        };
        securityUtil = {
            hash: vitest_1.vi.fn(),
        };
        service = new user_service_1.UserService(userRepository, securityUtil);
        // Default mock for findAuthById to return the mockUser
        userRepository.findAuthById.mockResolvedValue(mockUser);
    });
    (0, vitest_1.describe)("registerUser()", () => {
        (0, vitest_1.it)("should create a user when email and phone are unique", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.findByPhone.mockResolvedValue(null);
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.registerUser(Object.assign({}, createUserData));
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(userRepository.findByEmail).toHaveBeenCalledWith(createUserData.email);
            (0, vitest_1.expect)(userRepository.findByPhone).toHaveBeenCalledWith(createUserData.phone);
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledWith(createUserData, undefined);
        }));
        (0, vitest_1.it)("should create a user without checking email when email is not provided", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { email: undefined });
            userRepository.findByPhone.mockResolvedValue(null);
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.registerUser(data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(userRepository.findByEmail).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.findByPhone).toHaveBeenCalledWith(data.phone);
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledWith(data, undefined);
        }));
        (0, vitest_1.it)("should create a user without checking phone when phone is not provided", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { phone: undefined });
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.registerUser(data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(userRepository.findByEmail).toHaveBeenCalledWith(data.email);
            (0, vitest_1.expect)(userRepository.findByPhone).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledWith(data, undefined);
        }));
        (0, vitest_1.it)("should create a user without checking email or phone when neither is provided", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { email: undefined, phone: undefined });
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.registerUser(data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(userRepository.findByEmail).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.findByPhone).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledWith(data, undefined);
        }));
        (0, vitest_1.it)("should throw a duplicate error when email already exists", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { email: "existing@example.com" });
            userRepository.findByEmail.mockResolvedValue(mockUser);
            yield (0, vitest_1.expect)(service.registerUser(data)).rejects.toMatchObject({
                message: "Duplicate email already exists",
                errorCode: messages_1.default.DUPLICATE_DATA.code,
                statusCode: 409,
            });
            (0, vitest_1.expect)(userRepository.findByEmail).toHaveBeenCalledWith(data.email);
            (0, vitest_1.expect)(userRepository.findByPhone).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.create).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should throw a duplicate error when phone already exists", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { phone: "9999999999" });
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.findByPhone.mockResolvedValue(mockUser);
            yield (0, vitest_1.expect)(service.registerUser(data)).rejects.toMatchObject({
                message: "Duplicate phone number already exists",
                errorCode: messages_1.default.DUPLICATE_DATA.code,
                statusCode: 409,
            });
            (0, vitest_1.expect)(userRepository.findByEmail).toHaveBeenCalledWith(data.email);
            (0, vitest_1.expect)(userRepository.findByPhone).toHaveBeenCalledWith(data.phone);
            (0, vitest_1.expect)(userRepository.create).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should not check phone when email is already duplicated", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.findByEmail.mockResolvedValue(mockUser);
            yield (0, vitest_1.expect)(service.registerUser(Object.assign({}, createUserData))).rejects.toMatchObject({
                errorCode: messages_1.default.DUPLICATE_DATA.code,
                statusCode: 409,
            });
            (0, vitest_1.expect)(userRepository.findByPhone).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.create).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should propagate repository create errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Database error");
            userRepository.findByEmail.mockResolvedValue(null);
            userRepository.findByPhone.mockResolvedValue(null);
            userRepository.create.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.registerUser(Object.assign({}, createUserData))).rejects.toThrow("Database error");
        }));
    });
    (0, vitest_1.describe)("createUser()", () => {
        (0, vitest_1.it)("should hash the password before creating the user", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { password: "PlainPassword123!" });
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.createUser(data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(securityUtil.hash).toHaveBeenCalledWith("PlainPassword123!");
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledWith(Object.assign(Object.assign({}, data), { password: "hashed-password" }));
        }));
        (0, vitest_1.it)("should not hash the password when password is null", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { password: null });
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.createUser(data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(securityUtil.hash).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledWith(data);
        }));
        (0, vitest_1.it)("should not hash the password when password is undefined", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, createUserData), { password: undefined });
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.createUser(data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(securityUtil.hash).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledWith(data);
        }));
        (0, vitest_1.it)("should return the created user", () => __awaiter(void 0, void 0, void 0, function* () {
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockResolvedValue(mockUser);
            const result = yield service.createUser(Object.assign({}, createUserData));
            (0, vitest_1.expect)(result).toEqual(mockUser);
        }));
        (0, vitest_1.it)("should throw a server error when repository returns null", () => __awaiter(void 0, void 0, void 0, function* () {
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.createUser(Object.assign({}, createUserData))).rejects.toMatchObject({
                message: messages_1.default.SERVER_ERROR.message,
                errorCode: messages_1.default.SERVER_ERROR.code,
                statusCode: 500,
            });
            (0, vitest_1.expect)(userRepository.create).toHaveBeenCalledTimes(1);
        }));
        (0, vitest_1.it)("should propagate password hashing errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Hashing failed");
            securityUtil.hash.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.createUser(Object.assign({}, createUserData))).rejects.toThrow("Hashing failed");
            (0, vitest_1.expect)(userRepository.create).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should propagate repository errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Database error");
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.create.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.createUser(Object.assign({}, createUserData))).rejects.toThrow("Database error");
        }));
    });
    (0, vitest_1.describe)("updateUser()", () => {
        (0, vitest_1.it)("should hash the password before updating the user", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, updateUserData), { password: "PlainPassword123!" });
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.update.mockResolvedValue(mockUser);
            const result = yield service.updateUser(42, data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(securityUtil.hash).toHaveBeenCalledWith("PlainPassword123!");
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(42, Object.assign(Object.assign({}, data), { password: "hashed-password" }));
        }));
        (0, vitest_1.it)("should not hash the password when password is null", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, updateUserData), { password: null });
            userRepository.update.mockResolvedValue(mockUser);
            const result = yield service.updateUser(42, data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(securityUtil.hash).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(42, data);
        }));
        (0, vitest_1.it)("should not hash the password when password is undefined", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, updateUserData), { password: undefined });
            userRepository.update.mockResolvedValue(mockUser);
            const result = yield service.updateUser(42, data);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(securityUtil.hash).not.toHaveBeenCalled();
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(42, data);
        }));
        (0, vitest_1.it)("should return the updated user", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.update.mockResolvedValue(mockUser);
            const result = yield service.updateUser(42, Object.assign({}, updateUserData));
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
        }));
        (0, vitest_1.it)("should throw a server error when repository returns null", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.update.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.updateUser(42, Object.assign({}, updateUserData))).rejects.toMatchObject({
                message: messages_1.default.DATA_NOT_FOUND.message,
                errorCode: messages_1.default.DATA_NOT_FOUND.code,
                statusCode: 404,
            });
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(42, updateUserData);
        }));
        (0, vitest_1.it)("should propagate password hashing errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Hashing failed");
            securityUtil.hash.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.updateUser(42, Object.assign(Object.assign({}, updateUserData), { password: "Password123!" }))).rejects.toThrow("Hashing failed");
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(userRepository.update).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should propagate repository errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Database error");
            userRepository.update.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.updateUser(42, Object.assign({}, updateUserData))).rejects.toThrow("Database error");
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
        }));
        (0, vitest_1.it)("should increment authorization_version when role_id changes", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, updateUserData), { role_id: 2 });
            securityUtil.hash.mockResolvedValue("hashed-password");
            userRepository.update.mockResolvedValue(Object.assign(Object.assign({}, mockUser), { role_id: 2, authorization_version: 1 }));
            const result = yield service.updateUser(42, data);
            (0, vitest_1.expect)(result).toEqual(vitest_1.expect.objectContaining({ role_id: 2, authorization_version: 1 }));
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(42, vitest_1.expect.objectContaining({
                role_id: 2,
                authorization_version: 1,
            }));
        }));
        (0, vitest_1.it)("should increment authorization_version when status changes", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = Object.assign(Object.assign({}, updateUserData), { status: "Suspended" });
            userRepository.update.mockResolvedValue(Object.assign(Object.assign({}, mockUser), { status: "Suspended", authorization_version: 1 }));
            const result = yield service.updateUser(42, data);
            (0, vitest_1.expect)(result).toEqual(vitest_1.expect.objectContaining({ status: "Suspended", authorization_version: 1 }));
            (0, vitest_1.expect)(userRepository.findAuthById).toHaveBeenCalledWith(42);
            (0, vitest_1.expect)(userRepository.update).toHaveBeenCalledWith(42, vitest_1.expect.objectContaining({
                status: "Suspended",
                authorization_version: 1,
            }));
        }));
    });
    (0, vitest_1.describe)("browseUsers()", () => {
        (0, vitest_1.it)("should return users from the repository", () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                role_id: 1,
                status: "Activated",
                search: "john",
                cursor: 100,
                limit: 20,
            };
            userRepository.browse.mockResolvedValue(browseResult);
            const result = yield service.browseUsers(query);
            (0, vitest_1.expect)(result).toEqual(browseResult);
            (0, vitest_1.expect)(userRepository.browse).toHaveBeenCalledWith(query);
        }));
        (0, vitest_1.it)("should support browsing without filters", () => __awaiter(void 0, void 0, void 0, function* () {
            const query = {
                cursor: undefined,
                limit: 20,
            };
            userRepository.browse.mockResolvedValue(browseResult);
            const result = yield service.browseUsers(query);
            (0, vitest_1.expect)(result).toEqual(browseResult);
            (0, vitest_1.expect)(userRepository.browse).toHaveBeenCalledWith(query);
        }));
        (0, vitest_1.it)("should return an empty result when repository returns no users", () => __awaiter(void 0, void 0, void 0, function* () {
            const result = {
                data: [],
                hasMore: false,
                nextCursor: null,
            };
            userRepository.browse.mockResolvedValue(result);
            const query = {
                limit: 20,
            };
            yield (0, vitest_1.expect)(service.browseUsers(query)).resolves.toEqual(result);
            (0, vitest_1.expect)(userRepository.browse).toHaveBeenCalledWith(query);
        }));
        (0, vitest_1.it)("should propagate repository errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Database error");
            userRepository.browse.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.browseUsers({
                limit: 20,
            })).rejects.toThrow("Database error");
        }));
    });
    (0, vitest_1.describe)("findById()", () => {
        (0, vitest_1.it)("should return the user when found", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.findById.mockResolvedValue(mockUser);
            const result = yield service.findById(42);
            (0, vitest_1.expect)(result).toEqual(mockUser);
            (0, vitest_1.expect)(userRepository.findById).toHaveBeenCalledWith(42);
        }));
        (0, vitest_1.it)("should throw a not-found AppError when user does not exist", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.findById.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.findById(42)).rejects.toMatchObject({
                message: messages_1.default.DATA_NOT_FOUND.message,
                errorCode: messages_1.default.DATA_NOT_FOUND.code,
                statusCode: 404,
            });
            (0, vitest_1.expect)(userRepository.findById).toHaveBeenCalledWith(42);
        }));
        (0, vitest_1.it)("should propagate repository errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Database error");
            userRepository.findById.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.findById(42)).rejects.toThrow("Database error");
        }));
    });
    (0, vitest_1.describe)("hardDelete()", () => {
        (0, vitest_1.it)("should delete the user successfully", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.hardDelete.mockResolvedValue(true);
            yield (0, vitest_1.expect)(service.hardDelete(42)).resolves.toBeUndefined();
            (0, vitest_1.expect)(userRepository.hardDelete).toHaveBeenCalledWith(42);
        }));
        (0, vitest_1.it)("should throw a delete-failed AppError when repository returns false", () => __awaiter(void 0, void 0, void 0, function* () {
            userRepository.hardDelete.mockResolvedValue(false);
            yield (0, vitest_1.expect)(service.hardDelete(42)).rejects.toMatchObject({
                message: messages_1.default.DELETE_FAILED.message,
                errorCode: messages_1.default.DELETE_FAILED.code,
                statusCode: 500,
            });
            (0, vitest_1.expect)(userRepository.hardDelete).toHaveBeenCalledWith(42);
        }));
        (0, vitest_1.it)("should propagate repository errors", () => __awaiter(void 0, void 0, void 0, function* () {
            const error = new Error("Database error");
            userRepository.hardDelete.mockRejectedValue(error);
            yield (0, vitest_1.expect)(service.hardDelete(42)).rejects.toThrow("Database error");
        }));
    });
});
