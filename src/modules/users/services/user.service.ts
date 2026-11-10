// src/modules/users/user.service.ts
import {UserRepository} from "../user.repository";
import {BrowseUsersQuery, BrowseUsersResult, CreateUserDTO, UpdateUserDTO, User} from "../user.interface";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {SecurityUtil} from "../../../common/utils/security.util";

export class UserService {
    // Dependency injection allows passing a mock repository during testing
    constructor(
        private userRepository: UserRepository,
        private readonly securityUtil: SecurityUtil,
    ) {
    }

    /**
     * Handles business logic for creating a user under registration form
     */
    async registerUser(data: CreateUserDTO): Promise<User> {
        // Check if email already exists
        if (data.email) {
            const existingEmail = await this.userRepository.findByEmail(data.email);
            if (existingEmail) {
                throw new AppError(
                    Messages.DUPLICATE_DATA,
                    "Duplicate email already exists"
                );
            }
        }

        // Check if phone already exists
        if (data.phone) {
            const existingPhone = await this.userRepository.findByPhone(data.phone);
            if (existingPhone) {
                throw new AppError(
                    Messages.DUPLICATE_DATA,
                    "Duplicate phone number already exists",
                );
            }
        }

        // Create and return the user
        return this.userRepository.create(data);
    }

    async createUser(data: CreateUserDTO): Promise<User> {
        if (data.password !== null && typeof data.password !== "undefined") {
            data.password = await this.securityUtil.hash(data.password);
        }

        const user: User | null = await this.userRepository.create(data);
        if (!user) {throw new AppError(Messages.SERVER_ERROR);}

        return user;
    }

    async updateUser(id: number, data: UpdateUserDTO): Promise<User> {
        if (data.password !== null && typeof data.password !== "undefined") {
            data.password = await this.securityUtil.hash(data.password);
        }

        const user: User | null = await this.userRepository.update(id, data);
        if (!user) {throw new AppError(Messages.DATA_NOT_FOUND);}

        return user;
    }

    async browseUsers(
        query: BrowseUsersQuery
    ): Promise<BrowseUsersResult> {
        return this.userRepository.browse(query);
    }

    /**
     * Resolves a user profile by its unique ID for authentication context mapping.
     */
    async findById(id: number): Promise<User> {
        const user: User | null = await this.userRepository.findById(id);
        if (!user) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }
        return user;
    }

    /**
     * Internal lookup that may include sensitive fields (e.g. password).
     * Never return this directly from a controller.
     */
    async findAuthById(id: number): Promise<User> {
        const user: User | null = await this.userRepository.findAuthById(id);
        if (!user) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }
        return user;
    }

    async hardDelete(id: number): Promise<void> {
        if (!await this.userRepository.hardDelete(id)) {
            throw new AppError(Messages.DELETE_FAILED);
        }
    }
}