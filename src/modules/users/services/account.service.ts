// src/modules/users/services/account.service.ts
import {SecurityAccountDTO, UpdateUserDTO, User} from "../user.interface";
import {UserRepository} from "../user.repository";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {TokenService} from "../../auth/services/authentication-token.service";
import {SecurityUtil} from "../../../common/utils/security.util";

export class AccountService {
    constructor(
        private readonly userRepository: UserRepository,
        private readonly tokenService: TokenService,
        private readonly securityUtil: SecurityUtil,
    ) {
    }

    async information(id: number, data: UpdateUserDTO): Promise<string> {
        const user: User | null = await this.userRepository.update(id, data, "Activated");

        if (!user) throw new AppError(Messages.SERVER_ERROR);

        // generate a JWT token
        return this.tokenService.generateToken({
            uid: user.id,
            tid: 0,
            tfa: false,
        });
    }

    async password(user: User, data: SecurityAccountDTO) {
        // verify the current password
        if (!user.password || !await this.securityUtil.compare(user.password, data.current_password)) {
            throw new AppError(Messages.CREDENTIAL_DO_NOT_MATCH);
        }

        // hashed if new password
        if (typeof data.new_password !== "undefined" && data.new_password !== null) {
            data.password = await this.securityUtil.hash(data.new_password);
        }

        // update the security details
        if (!await this.userRepository.update(user.id, data, "Activated")) {
            throw new AppError(Messages.UPDATE_FAILED);
        }

        // generate a JWT token
        if (typeof data.username !== "undefined") user.username = data.username;
        if (typeof data.email !== "undefined") user.email = data.email;
        if (typeof data.phone !== "undefined") user.phone = data.phone;
        return this.tokenService.generateToken({
            uid: user.id,
            tid: 0,
            tfa: false,
        });
    }
}