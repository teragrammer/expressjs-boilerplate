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
exports.UserService = void 0;
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
class UserService {
    // Dependency injection allows passing a mock repository during testing
    constructor(userRepository, securityUtil) {
        this.userRepository = userRepository;
        this.securityUtil = securityUtil;
    }
    /**
     * Handles business logic for creating a user under registration form
     *
     * An optional executor allows the caller to run the insert inside a
     * surrounding transaction (registration creates a user and a session
     * atomically).
     */
    registerUser(data, executor) {
        return __awaiter(this, void 0, void 0, function* () {
            // Check if email already exists
            if (data.email) {
                const existingEmail = yield this.userRepository.findByEmail(data.email);
                if (existingEmail) {
                    throw new errors_1.AppError(messages_1.default.DUPLICATE_DATA, "Duplicate email already exists");
                }
            }
            // Check if phone already exists
            if (data.phone) {
                const existingPhone = yield this.userRepository.findByPhone(data.phone);
                if (existingPhone) {
                    throw new errors_1.AppError(messages_1.default.DUPLICATE_DATA, "Duplicate phone number already exists");
                }
            }
            // Create and return the user
            return this.userRepository.create(data, executor);
        });
    }
    createUser(data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (data.password !== null && typeof data.password !== "undefined") {
                data.password = yield this.securityUtil.hash(data.password);
            }
            const user = yield this.userRepository.create(data);
            if (!user) {
                throw new errors_1.AppError(messages_1.default.SERVER_ERROR);
            }
            return user;
        });
    }
    updateUser(id, data) {
        return __awaiter(this, void 0, void 0, function* () {
            // First check current user to compare role_id and status
            const currentUser = yield this.userRepository.findAuthById(id);
            if (!currentUser) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            // Check if role_id or status is being changed to increment authorization_version
            const roleChanged = data.role_id !== undefined && data.role_id !== currentUser.role_id;
            const statusChanged = data.status !== undefined && data.status !== currentUser.status;
            if (roleChanged || statusChanged) {
                data.authorization_version = (currentUser.authorization_version || 0) + 1;
            }
            // Hash password if provided
            if (data.password !== null && typeof data.password !== "undefined") {
                data.password = yield this.securityUtil.hash(data.password);
            }
            const user = yield this.userRepository.update(id, data);
            if (!user) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            return user;
        });
    }
    browseUsers(query) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.userRepository.browse(query);
        });
    }
    /**
     * Resolves a user profile by its unique ID for authentication context mapping.
     */
    findById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userRepository.findById(id);
            if (!user) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            return user;
        });
    }
    /**
     * Internal lookup that may include sensitive fields (e.g. password).
     * Never return this directly from a controller.
     */
    findAuthById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userRepository.findAuthById(id);
            if (!user) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            return user;
        });
    }
    softDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.userRepository.softDelete(id))) {
                throw new errors_1.AppError(messages_1.default.DELETE_FAILED);
            }
        });
    }
    hardDelete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield this.userRepository.hardDelete(id))) {
                throw new errors_1.AppError(messages_1.default.DELETE_FAILED);
            }
        });
    }
}
exports.UserService = UserService;
