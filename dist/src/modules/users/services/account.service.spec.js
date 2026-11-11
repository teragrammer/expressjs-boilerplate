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
const account_service_1 = require("./account.service");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
(0, vitest_1.describe)("AccountService", () => {
    let service;
    let mockUserRepository;
    let mockSecurityUtil;
    let mockAuthTokenRepository;
    let mockRoleService;
    let mockDateUtil;
    let mockSessionService;
    let mockVerificationService;
    let mockPasswordRecoveryRepository;
    let user;
    (0, vitest_1.beforeEach)(() => {
        mockUserRepository = {
            update: vitest_1.vi.fn(),
            findAuthById: vitest_1.vi.fn(),
        };
        mockSecurityUtil = {
            compare: vitest_1.vi.fn(),
            hash: vitest_1.vi.fn(),
        };
        mockAuthTokenRepository = {
            findById: vitest_1.vi.fn(),
            update: vitest_1.vi.fn(),
            create: vitest_1.vi.fn(),
            deleteAllByUserId: vitest_1.vi.fn(),
        };
        mockRoleService = {
            findById: vitest_1.vi.fn(),
        };
        mockDateUtil = {
            expiredAt: vitest_1.vi.fn(),
        };
        mockSessionService = {
            issueForSession: vitest_1.vi.fn().mockResolvedValue({
                accessToken: "new.jwt.token",
                refreshToken: "refresh.token",
                sessionId: 99,
                expiresAt: new Date("2030-01-01T00:00:00.000Z"),
            }),
        };
        mockVerificationService = {
            resetFlag: vitest_1.vi.fn(),
            send: vitest_1.vi.fn(),
        };
        mockPasswordRecoveryRepository = {
            deleteAllByUserId: vitest_1.vi.fn(),
        };
        service = new account_service_1.AccountService(mockUserRepository, mockSecurityUtil, mockAuthTokenRepository, mockRoleService, mockDateUtil, mockSessionService, mockVerificationService, mockPasswordRecoveryRepository);
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
    (0, vitest_1.describe)("information()", () => {
        const currentTid = 45;
        (0, vitest_1.it)("should update the profile and issue a token bound to the current session", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = {
                first_name: "Jane",
                middle_name: "Michael",
                last_name: "Smith",
                address: "456 New Street",
            };
            const updatedUser = Object.assign(Object.assign({}, user), { first_name: "Jane", middle_name: "Michael", last_name: "Smith", address: "456 New Street" });
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
            const result = yield service.information(1, data, currentTid);
            (0, vitest_1.expect)(mockUserRepository.update).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockUserRepository.update).toHaveBeenCalledWith(1, data, "Activated");
            // The current session is refreshed, never replaced.
            (0, vitest_1.expect)(mockAuthTokenRepository.update).toHaveBeenCalledWith(currentTid, { expired_at: newExpiredAt });
            (0, vitest_1.expect)(mockRoleService.findById).toHaveBeenCalledWith(user.role_id);
            // The token references the real session id (no `tid: 0`).
            (0, vitest_1.expect)(mockSessionService.issueForSession).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockSessionService.issueForSession).toHaveBeenCalledWith(currentTid, updatedUser, role, false);
            (0, vitest_1.expect)(result).toBe("new.jwt.token");
        }));
        (0, vitest_1.it)("should throw a server error when the user cannot be updated", () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepository.update.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.information(1, { first_name: "Jane" }, currentTid)).rejects.toMatchObject({
                errorCode: messages_1.default.SERVER_ERROR.code,
            });
            (0, vitest_1.expect)(mockSessionService.issueForSession).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should reset the verification flag when the email changes", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = {
                first_name: "Jane",
                last_name: "Smith",
                email: "new@example.com",
            };
            mockUserRepository.findAuthById.mockResolvedValue(user);
            mockUserRepository.update.mockResolvedValue(Object.assign(Object.assign({}, user), { email: "new@example.com" }));
            mockRoleService.findById.mockResolvedValue({
                slug: "customer",
                is_bypass_authorization: false,
            });
            yield service.information(1, data, currentTid);
            (0, vitest_1.expect)(mockVerificationService.resetFlag).toHaveBeenCalledWith(user.id, "email");
            (0, vitest_1.expect)(mockVerificationService.send).toHaveBeenCalledWith(user.id, "email", "new@example.com");
        }));
        (0, vitest_1.it)("should reset the verification flag when the phone changes", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = {
                first_name: "Jane",
                last_name: "Smith",
                phone: "+19998887777",
            };
            mockUserRepository.findAuthById.mockResolvedValue(user);
            mockUserRepository.update.mockResolvedValue(Object.assign(Object.assign({}, user), { phone: "+19998887777" }));
            mockRoleService.findById.mockResolvedValue({
                slug: "customer",
                is_bypass_authorization: false,
            });
            yield service.information(1, data, currentTid);
            (0, vitest_1.expect)(mockVerificationService.resetFlag).toHaveBeenCalledWith(user.id, "phone");
            (0, vitest_1.expect)(mockVerificationService.send).toHaveBeenCalledWith(user.id, "phone", "+19998887777");
        }));
        (0, vitest_1.it)("should not touch verification flags when the contact is unchanged", () => __awaiter(void 0, void 0, void 0, function* () {
            mockUserRepository.findAuthById.mockResolvedValue(user);
            mockUserRepository.update.mockResolvedValue(user);
            mockRoleService.findById.mockResolvedValue({
                slug: "customer",
                is_bypass_authorization: false,
            });
            yield service.information(1, { first_name: "Jane", last_name: "Smith" }, currentTid);
            (0, vitest_1.expect)(mockVerificationService.resetFlag).not.toHaveBeenCalled();
            (0, vitest_1.expect)(mockVerificationService.send).not.toHaveBeenCalled();
        }));
    });
    (0, vitest_1.describe)("password()", () => {
        const currentTid = 45;
        (0, vitest_1.it)("should reject when the current password does not match", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = {
                current_password: "wrong",
                new_password: "NewPassword123!",
            };
            mockSecurityUtil.compare.mockResolvedValue(false);
            yield (0, vitest_1.expect)(service.password(user, data, currentTid)).rejects.toMatchObject({
                errorCode: messages_1.default.CREDENTIAL_DO_NOT_MATCH.code,
            });
            (0, vitest_1.expect)(mockUserRepository.update).not.toHaveBeenCalled();
        }));
        (0, vitest_1.it)("should rotate the session, revoke the others and invalidate recovery codes", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = {
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
            const result = yield service.password(user, data, currentTid);
            (0, vitest_1.expect)(mockSecurityUtil.hash).toHaveBeenCalledWith("NewPassword123!");
            // Outstanding recovery codes are invalidated.
            (0, vitest_1.expect)(mockPasswordRecoveryRepository.deleteAllByUserId).toHaveBeenCalledWith(user.id);
            // A new session is created and every other session revoked.
            (0, vitest_1.expect)(mockAuthTokenRepository.create).toHaveBeenCalledTimes(1);
            (0, vitest_1.expect)(mockAuthTokenRepository.deleteAllByUserId).toHaveBeenCalledWith(user.id, newSession.id);
            (0, vitest_1.expect)(mockSessionService.issueForSession).toHaveBeenCalledWith(newSession.id, vitest_1.expect.objectContaining({ id: user.id }), vitest_1.expect.objectContaining({ slug: "customer" }), false, { includeRefreshToken: true });
            (0, vitest_1.expect)(result).toBe("new.jwt.token");
        }));
        (0, vitest_1.it)("should throw when the user update fails", () => __awaiter(void 0, void 0, void 0, function* () {
            const data = {
                current_password: "OldPassword123!",
            };
            mockSecurityUtil.compare.mockResolvedValue(true);
            mockUserRepository.update.mockResolvedValue(null);
            yield (0, vitest_1.expect)(service.password(user, data, currentTid)).rejects.toMatchObject({
                errorCode: messages_1.default.UPDATE_FAILED.code,
            });
        }));
    });
});
