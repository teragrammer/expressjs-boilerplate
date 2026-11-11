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
exports.TwoFactorAuthenticationService = void 0;
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const two_factor_authentication_interface_1 = require("./two-factor-authentication.interface");
class TwoFactorAuthenticationService {
    constructor(securityUtil, tfaRepository, authenticationTokenRepository, authTokenService, dateUtil, settingService, mailService, roleService, userRepository) {
        this.securityUtil = securityUtil;
        this.tfaRepository = tfaRepository;
        this.authenticationTokenRepository = authenticationTokenRepository;
        this.authTokenService = authTokenService;
        this.dateUtil = dateUtil;
        this.settingService = settingService;
        this.mailService = mailService;
        this.roleService = roleService;
        this.userRepository = userRepository;
    }
    sendOtp(input) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertOtpRequired(input.tfaCleared);
            this.assertEmailConfigured(input.email);
            // generate OTP code
            const { id, nextTry, plainCode } = yield this.generateOtp(input.tokenId);
            // send email
            yield this.sendOtpEmail(input.email, plainCode);
            return {
                id,
                nextTry,
            };
        });
    }
    verifyOtp(input) {
        return __awaiter(this, void 0, void 0, function* () {
            this.assertOtpRequired(input.tfaCleared);
            const tfa = yield this.tfaRepository.findByTokenId(input.tokenId);
            if (!tfa) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            if (!tfa.expired_at) {
                throw new errors_1.AppError(messages_1.default.UN_CONFIGURED_EXPIRATION);
            }
            const currentTime = this.dateUtil.unix();
            const expiredAt = this.dateUtil.unix(new Date(tfa.expired_at));
            if (currentTime > expiredAt) {
                throw new errors_1.AppError(messages_1.default.RESOURCE_EXPIRED);
            }
            if (tfa.expired_tries_at) {
                const expiredTriesAt = this.dateUtil.unix(new Date(tfa.expired_tries_at));
                if (expiredTriesAt > currentTime) {
                    throw new errors_1.AppError(messages_1.default.TOO_MANY_ATTEMPTS);
                }
                yield this.tfaRepository.resetTries(tfa.id);
                tfa.tries = 0;
            }
            if (tfa.tries >= 5) {
                // Set expired_tries_at for lockout duration instead of permanent lockout
                const lockoutDuration = 15; // 15 minutes
                yield this.tfaRepository.setExpiredTriesAt(tfa.id, this.dateUtil.expiredAt(lockoutDuration, "minutes"));
                throw new errors_1.AppError(messages_1.default.TOO_MANY_ATTEMPTS);
            }
            const isCodeMatch = yield this.securityUtil.compare(tfa.code, input.code);
            if (!isCodeMatch) {
                yield this.tfaRepository.incrementTries(tfa.id);
                throw new errors_1.AppError(messages_1.default.OTP_NO_MATCH);
            }
            yield this.tfaRepository.deleteById(tfa.id);
            yield this.authenticationTokenRepository
                .purgeExpiredTokensByUserId(input.user.id);
            const role = yield this.roleService.findById(input.user.role_id);
            return this.authTokenService.generateToken({
                uid: input.user.id,
                tid: input.tokenId,
                tfa: true,
                rol: role.slug,
                bpa: role.is_bypass_authorization ? 1 : 0,
                av: input.user.authorization_version || 0,
            });
        });
    }
    /**
     * Enrolls a user in TFA by verifying an OTP and setting has_tfa = true.
     * Generates recovery codes for the user.
     */
    enrollTfa(input) {
        return __awaiter(this, void 0, void 0, function* () {
            const tfa = yield this.tfaRepository.findByTokenId(input.tokenId);
            if (!tfa) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            if (!tfa.expired_at) {
                throw new errors_1.AppError(messages_1.default.UN_CONFIGURED_EXPIRATION);
            }
            const currentTime = this.dateUtil.unix();
            const expiredAt = this.dateUtil.unix(new Date(tfa.expired_at));
            if (currentTime > expiredAt) {
                throw new errors_1.AppError(messages_1.default.RESOURCE_EXPIRED);
            }
            const isCodeMatch = yield this.securityUtil.compare(tfa.code, input.code);
            if (!isCodeMatch) {
                yield this.tfaRepository.incrementTries(tfa.id);
                throw new errors_1.AppError(messages_1.default.OTP_NO_MATCH);
            }
            // Generate recovery codes
            const recoveryCodes = this.generateRecoveryCodes(8);
            // Hash recovery codes for storage
            const hashedRecoveryCodes = yield Promise.all(recoveryCodes.map(code => this.securityUtil.hash(code)));
            // Update user: set has_tfa = true and store hashed recovery codes
            yield this.userRepository.update(input.userId, {
                has_tfa: true,
                tfa_secret: hashedRecoveryCodes.join(","),
            });
            // Delete the used OTP
            yield this.tfaRepository.deleteById(tfa.id);
            // Purge expired tokens
            yield this.authenticationTokenRepository.purgeExpiredTokensByUserId(input.userId);
            return {
                enrolled: true,
                recoveryCodes,
            };
        });
    }
    /**
     * Disables TFA for a user (requires password verification).
     */
    disableTfa(userId, password) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userRepository.findAuthById(userId);
            if (!user || !user.password) {
                throw new errors_1.AppError(messages_1.default.USER_NOT_FOUND);
            }
            const isPasswordMatch = yield this.securityUtil.compare(user.password, password);
            if (!isPasswordMatch) {
                throw new errors_1.AppError(messages_1.default.CREDENTIAL_DO_NOT_MATCH);
            }
            yield this.userRepository.update(userId, {
                has_tfa: false,
                tfa_secret: null,
            });
        });
    }
    /**
     * Gets the current TFA policy from settings.
     */
    getTfaPolicy() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const settings = yield this.settingService.getCache();
            const policyValue = (_a = settings.pri) === null || _a === void 0 ? void 0 : _a.tta_policy;
            switch (policyValue) {
                case two_factor_authentication_interface_1.TfaPolicy.GLOBAL:
                    return two_factor_authentication_interface_1.TfaPolicy.GLOBAL;
                case two_factor_authentication_interface_1.TfaPolicy.PER_USER:
                    return two_factor_authentication_interface_1.TfaPolicy.PER_USER;
                default:
                    return two_factor_authentication_interface_1.TfaPolicy.DISABLED;
            }
        });
    }
    /**
     * Checks if TFA is required for a user based on policy.
     */
    isTfaRequired(user) {
        return __awaiter(this, void 0, void 0, function* () {
            const policy = yield this.getTfaPolicy();
            switch (policy) {
                case two_factor_authentication_interface_1.TfaPolicy.GLOBAL:
                    return true;
                case two_factor_authentication_interface_1.TfaPolicy.PER_USER:
                    return user.has_tfa === true;
                case two_factor_authentication_interface_1.TfaPolicy.DISABLED:
                default:
                    return false;
            }
        });
    }
    generateOtp(tokenId) {
        return __awaiter(this, void 0, void 0, function* () {
            const nextTryDate = this.dateUtil.expiredAt(2, "minutes");
            const nextTry = nextTryDate instanceof Date
                ? nextTryDate.toISOString()
                : String(nextTryDate);
            const plainCode = String(this.securityUtil.randomNumber());
            const hashedCode = yield this.securityUtil.hash(plainCode);
            const expiredAt = this.dateUtil.expiredAt(5, "minutes");
            const issuedOtp = yield this.tfaRepository.issueOtp(tokenId, {
                code: hashedCode,
                expired_at: expiredAt,
                next_send_at: nextTry,
                created_at: this.dateUtil.sql(),
            });
            return {
                id: issuedOtp.id,
                nextTry,
                plainCode,
            };
        });
    }
    sendOtpEmail(email, plainCode) {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = yield this.settingService.getCache();
            const emailSettings = settings.pri;
            yield this.mailService.send({
                to: email,
                from: emailSettings.tta_eml_snd,
                subject: emailSettings.tta_eml_sbj,
                text: `OTP Code: ${plainCode}`,
            });
        });
    }
    assertOtpRequired(tfaCleared) {
        if (tfaCleared) {
            throw new errors_1.AppError(messages_1.default.OTP_NOT_NEEDED);
        }
    }
    assertEmailConfigured(email) {
        if (!email || email.trim() === "") {
            throw new errors_1.AppError(messages_1.default.UN_CONFIGURED_EMAIL);
        }
    }
    generateRecoveryCodes(count) {
        const codes = [];
        for (let i = 0; i < count; i++) {
            // Generate 8-character alphanumeric recovery codes
            const code = this.securityUtil.randomString(8).toUpperCase();
            codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
        }
        return codes;
    }
}
exports.TwoFactorAuthenticationService = TwoFactorAuthenticationService;
