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
exports.VerificationService = void 0;
// src/modules/auth/verification/verification.service.ts
const node_crypto_1 = require("node:crypto");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const outbox_interface_1 = require("../../jobs/outbox.interface");
/**
 * Verification tokens are high-entropy random values.
 *
 * They are hashed with SHA-256 rather than bcrypt: the token has 256
 * bits of entropy, so a slow KDF adds latency without adding security.
 */
const TOKEN_BYTES = 32;
class VerificationService {
    constructor(securityUtil, verificationRepository, userRepository, settingService, outboxRepository, mailService, dateUtil) {
        this.securityUtil = securityUtil;
        this.verificationRepository = verificationRepository;
        this.userRepository = userRepository;
        this.settingService = settingService;
        this.outboxRepository = outboxRepository;
        this.mailService = mailService;
        this.dateUtil = dateUtil;
    }
    /**
     * Resolves the verification policy from the settings cache.
     */
    getPolicy() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            const settings = yield this.settingService.getCache();
            const requiredForRecovery = Number((_b = (_a = settings.pri) === null || _a === void 0 ? void 0 : _a.ver_req_rcv) !== null && _b !== void 0 ? _b : 0);
            return {
                emailTtlHours: Number((_d = (_c = settings.pri) === null || _c === void 0 ? void 0 : _c.ver_eml_ttl) !== null && _d !== void 0 ? _d : 24),
                phoneTtlMinutes: Number((_f = (_e = settings.pri) === null || _e === void 0 ? void 0 : _e.ver_phn_ttl) !== null && _f !== void 0 ? _f : 10),
                maxAttempts: Number((_h = (_g = settings.pri) === null || _g === void 0 ? void 0 : _g.ver_max_try) !== null && _h !== void 0 ? _h : 5),
                requiredForRecovery: requiredForRecovery === 1,
            };
        });
    }
    /**
     * Hashes a verification token for storage.
     */
    hashToken(token) {
        return (0, node_crypto_1.createHash)("sha256").update(token).digest("hex");
    }
    /**
     * Issues a verification token for a user/channel target.
     *
     * The plain token is delivered through the outbox so it is never
     * sent inside a database transaction, and any previously issued
     * token for the same channel is invalidated.
     */
    send(userId, channel, target) {
        return __awaiter(this, void 0, void 0, function* () {
            const policy = yield this.getPolicy();
            const expiresAt = channel === "email"
                ? this.dateUtil.expiredAt(policy.emailTtlHours, "hours")
                : this.dateUtil.expiredAt(policy.phoneTtlMinutes, "minutes");
            const plainToken = (0, node_crypto_1.randomBytes)(TOKEN_BYTES).toString("base64url");
            yield this.verificationRepository.invalidateForUserChannel(userId, channel);
            yield this.verificationRepository.create({
                user_id: userId,
                channel,
                target,
                token_hash: this.hashToken(plainToken),
                expires_at: expiresAt,
            });
            if (channel === "email") {
                const settings = yield this.settingService.getCache();
                /*
                 * The email is dispatched by the outbox worker, so a slow
                 * provider never blocks the request or holds a transaction.
                 */
                yield this.outboxRepository.enqueue({
                    type: outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL,
                    payload: {
                        to: target,
                        from: settings.pri.ver_eml_snd,
                        subject: settings.pri.ver_eml_sbj,
                        text: `Your verification code is: ${plainToken}`,
                    },
                });
            }
            return { sent: true, expiresAt };
        });
    }
    /**
     * Confirms a verification token and flips the matching flag.
     */
    confirm(userId, token) {
        return __awaiter(this, void 0, void 0, function* () {
            const stored = yield this.verificationRepository.findByHash(this.hashToken(token));
            if (!stored || stored.user_id !== userId) {
                throw new errors_1.AppError(messages_1.default.INVALID_TOKEN, "The verification link is invalid or has expired.");
            }
            if (stored.consumed_at) {
                throw new errors_1.AppError(messages_1.default.INVALID_TOKEN, "The verification link has already been used.");
            }
            if (new Date(stored.expires_at).getTime() <= Date.now()) {
                throw new errors_1.AppError(messages_1.default.EXPIRED_TOKEN, "The verification link has expired. Please request a new one.");
            }
            const policy = yield this.getPolicy();
            if (stored.attempts >= policy.maxAttempts) {
                throw new errors_1.AppError(messages_1.default.TOO_MANY_ATTEMPTS, "Too many verification attempts. Please request a new code.");
            }
            yield this.verificationRepository.consume(stored.id);
            if (stored.channel === "email") {
                yield this.userRepository.update(userId, {
                    is_email_verified: true,
                });
            }
            else {
                yield this.userRepository.update(userId, {
                    is_phone_verified: true,
                });
            }
            return { verified: true, channel: stored.channel };
        });
    }
    /**
     * Checks whether a contact target has been verified for a user.
     *
     * Used by the recovery flow to refuse recovery through an
     * unverified channel.
     */
    isTargetVerified(userId, channel, target) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.verificationRepository.isTargetVerified(userId, channel, target);
        });
    }
    /**
     * Resets the verification flag for a channel.
     *
     * Called when the contact value changes so the new target must be
     * verified before it can be used for recovery.
     */
    resetFlag(userId, channel) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.verificationRepository.invalidateForUserChannel(userId, channel);
            if (channel === "email") {
                yield this.userRepository.update(userId, {
                    is_email_verified: false,
                });
            }
            else {
                yield this.userRepository.update(userId, {
                    is_phone_verified: false,
                });
            }
        });
    }
}
exports.VerificationService = VerificationService;
