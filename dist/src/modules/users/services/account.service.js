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
exports.AccountService = void 0;
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const environment_1 = require("../../../config/environment");
class AccountService {
    constructor(userRepository, securityUtil, authenticationTokenRepository, roleService, dateUtil, sessionService, verificationService, passwordRecoveryRepository) {
        this.userRepository = userRepository;
        this.securityUtil = securityUtil;
        this.authenticationTokenRepository = authenticationTokenRepository;
        this.roleService = roleService;
        this.dateUtil = dateUtil;
        this.sessionService = sessionService;
        this.verificationService = verificationService;
        this.passwordRecoveryRepository = passwordRecoveryRepository;
    }
    /**
     * Updates the caller's profile fields.
     *
     * The current session is preserved and a fresh access token is
     * issued against it, so the caller never receives a token that
     * bypasses the session check.
     */
    information(id_1, data_1, currentTid_1) {
        return __awaiter(this, arguments, void 0, function* (id, data, currentTid, tfa = false) {
            /*
             * The current contact values are read before the update so a
             * changed email/phone can be detected: the repository returns
             * the *updated* row, which would otherwise look unchanged.
             */
            const previous = yield this.userRepository.findAuthById(id);
            const user = yield this.userRepository.update(id, data, "Activated");
            if (!user) {
                throw new errors_1.AppError(messages_1.default.SERVER_ERROR);
            }
            /*
             * A changed email or phone must be re-verified before it can be
             * used, so the verification flag is reset and the pending value
             * is sent for verification.
             */
            yield this.handleContactChange(previous, user, data);
            // Keep the current session alive and refresh its expiry.
            const newExpiredAt = this.dateUtil.expiredAt(Number(environment_1.__ENV.JWT_REFRESH_TOKEN_DAYS || 7), "days");
            yield this.authenticationTokenRepository.update(currentTid, {
                expired_at: newExpiredAt,
            });
            const role = yield this.roleService.findById(user.role_id);
            const issued = yield this.sessionService.issueForSession(currentTid, user, role, tfa);
            return issued.accessToken;
        });
    }
    /**
     * Changes the caller's credentials.
     *
     * Every other session is revoked, the current session is rotated to
     * a new session id, and outstanding recovery codes are invalidated
     * so a stale recovery token cannot be used afterwards.
     */
    password(user_1, data_1, currentTid_1) {
        return __awaiter(this, arguments, void 0, function* (user, data, currentTid, tfa = false) {
            // verify the current password
            if (!user.password ||
                !(yield this.securityUtil.compare(user.password, data.current_password))) {
                throw new errors_1.AppError(messages_1.default.CREDENTIAL_DO_NOT_MATCH);
            }
            // hashed if new password
            if (typeof data.new_password !== "undefined" && data.new_password !== null) {
                data.password = yield this.securityUtil.hash(data.new_password);
            }
            // update the security details
            if (!(yield this.userRepository.update(user.id, data, "Activated"))) {
                throw new errors_1.AppError(messages_1.default.UPDATE_FAILED);
            }
            /*
             * Invalidate outstanding recovery codes: a password change means
             * any recovery code issued earlier must not be redeemable.
             */
            yield this.passwordRecoveryRepository.deleteAllByUserId(user.id);
            /*
             * Rotate the current session and revoke every other session for
             * the user. The caller receives a token bound to the new session.
             */
            const newSession = yield this.authenticationTokenRepository.create({
                user_id: user.id,
                expired_at: this.dateUtil.expiredAt(Number(environment_1.__ENV.JWT_REFRESH_TOKEN_DAYS || 7), "days"),
                ip: null,
                browser: null,
                os: null,
            });
            yield this.authenticationTokenRepository.deleteAllByUserId(user.id, newSession.id);
            // Update user object with new values for token
            if (typeof data.username !== "undefined") {
                user.username = data.username;
            }
            if (typeof data.email !== "undefined") {
                user.email = data.email;
            }
            if (typeof data.phone !== "undefined") {
                user.phone = data.phone;
            }
            const role = yield this.roleService.findById(user.role_id);
            const issued = yield this.sessionService.issueForSession(newSession.id, user, role, tfa, { includeRefreshToken: true });
            return issued.accessToken;
        });
    }
    /**
     * Resets verification flags and schedules verification for a
     * changed contact value.
     */
    handleContactChange(previous, updated, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const previousEmail = (_a = previous === null || previous === void 0 ? void 0 : previous.email) !== null && _a !== void 0 ? _a : null;
            const previousPhone = (_b = previous === null || previous === void 0 ? void 0 : previous.phone) !== null && _b !== void 0 ? _b : null;
            if (typeof data.email !== "undefined" &&
                data.email !== null &&
                data.email !== "" &&
                data.email !== previousEmail) {
                yield this.verificationService.resetFlag(updated.id, "email");
                yield this.verificationService.send(updated.id, "email", data.email);
            }
            if (typeof data.phone !== "undefined" &&
                data.phone !== null &&
                data.phone !== "" &&
                data.phone !== previousPhone) {
                yield this.verificationService.resetFlag(updated.id, "phone");
                yield this.verificationService.send(updated.id, "phone", data.phone);
            }
        });
    }
}
exports.AccountService = AccountService;
