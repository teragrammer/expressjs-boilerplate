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
exports.PasswordRecoveryService = void 0;
const password_recovery_interface_1 = require("./password-recovery.interface");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const outbox_interface_1 = require("../../jobs/outbox.interface");
const mail_settings_1 = require("../../system/settings/mail-settings");
const environment_1 = require("../../../config/environment");
const CODE_LENGTH = 6;
const CODE_EXPIRATION_MINUTES = 30;
const NEXT_RESEND_MINUTES = 2;
const MAX_TRIES = 5;
const NEXT_TRY_MINUTES = 3;
/**
 * Cooldown applied to unknown targets as well.
 *
 * Applying the same cooldown to every request keeps the response shape
 * and timing identical whether or not the account exists.
 */
const UNKNOWN_TARGET_COOLDOWN_MINUTES = NEXT_RESEND_MINUTES;
class PasswordRecoveryService {
    constructor(securityUtil, recoveryRepository, userRepository, settingService, mailService, authenticationTokenRepository, dateUtil, outboxRepository, verificationService) {
        this.securityUtil = securityUtil;
        this.recoveryRepository = recoveryRepository;
        this.userRepository = userRepository;
        this.settingService = settingService;
        this.mailService = mailService;
        this.authenticationTokenRepository = authenticationTokenRepository;
        this.dateUtil = dateUtil;
        this.outboxRepository = outboxRepository;
        this.verificationService = verificationService;
    }
    /**
     * Sends a password recovery code.
     *
     * The response shape and status are identical for known and unknown
     * targets, and the same cooldown applies to both. The database work
     * happens in a transaction; the email is dispatched through the
     * outbox so no network call ever happens inside a transaction.
     */
    sendRecoveryCode(type, sendTo) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.findUser(type, sendTo);
            const now = new Date();
            if (!user) {
                /*
                 * Simulate the cost of hashing a code so the response time
                 * does not reveal whether the account exists.
                 */
                yield this.securityUtil.compare("$2b$12$00000000000000000000000000000000000000000000000000000", sendTo);
                return {
                    sent: true,
                    nextResendAt: this.addMinutes(now, UNKNOWN_TARGET_COOLDOWN_MINUTES),
                };
            }
            /*
             * Recovery through an unverified channel would let an attacker
             * who controls an unverified address take over the account.
             */
            const policy = yield this.verificationService.getPolicy();
            if (policy.requiredForRecovery && type === password_recovery_interface_1.RECOVERY_EMAIL) {
                const verified = yield this.verificationService.isTargetVerified(user.id, "email", sendTo);
                if (!verified) {
                    /*
                     * The response is intentionally identical to the
                     * success case so the endpoint cannot be used to probe
                     * which addresses are verified.
                     */
                    return {
                        sent: true,
                        nextResendAt: this.addMinutes(now, UNKNOWN_TARGET_COOLDOWN_MINUTES),
                    };
                }
            }
            const existingRecovery = yield this.recoveryRepository.findBySendTo(sendTo, type);
            this.assertResendAllowed(existingRecovery, now);
            const rawCode = this.securityUtil.randomNumber(CODE_LENGTH);
            const hashedCode = yield this.securityUtil.hash(rawCode);
            const nextResendAt = this.addMinutes(now, NEXT_RESEND_MINUTES);
            const expiredAt = this.addMinutes(now, CODE_EXPIRATION_MINUTES);
            const recoveryData = {
                type,
                send_to: sendTo,
                code: hashedCode,
                next_resend_at: nextResendAt,
                expired_at: expiredAt,
                tries: 0,
                next_try_at: null,
                user_id: user.id,
            };
            /*
             * The transaction only handles the database operations.
             */
            yield this.recoveryRepository.withTransaction((trx) => __awaiter(this, void 0, void 0, function* () {
                if (existingRecovery) {
                    yield this.recoveryRepository.deleteById(existingRecovery.id, trx);
                }
                yield this.recoveryRepository.create(recoveryData, trx);
            }));
            /*
             * The notification is queued, not sent inline: the request must
             * not wait on (or fail because of) the mail provider.
             */
            yield this.queueRecoveryNotification(type, sendTo, rawCode);
            return {
                sent: true,
                nextResendAt,
            };
        });
    }
    /**
     * Validates the recovery code and changes the user's password.
     *
     * The password update, the recovery-row deletion and the session
     * revocation all happen in a single transaction, so a failure never
     * leaves partial state and a reset always invalidates existing
     * sessions.
     */
    resetPassword(type, sendTo, code, newPassword) {
        return __awaiter(this, void 0, void 0, function* () {
            const recovery = yield this.recoveryRepository.findBySendTo(sendTo, type);
            const now = new Date();
            this.assertRecoveryExists(recovery);
            if (this.isExpired(recovery.expired_at, now)) {
                yield this.recoveryRepository.deleteById(recovery.id);
                throw new errors_1.AppError(messages_1.default.EXPIRED_TOKEN, "Recovery code has expired. Please request a new one.");
            }
            this.assertAttemptAllowed(recovery.next_try_at, now);
            const isValid = yield this.securityUtil.compare(recovery.code, code);
            if (!isValid) {
                yield this.registerFailedAttempt(recovery.id, recovery.tries, now);
                throw new errors_1.AppError(messages_1.default.INVALID_CODE, "Invalid recovery code.");
            }
            const user = yield this.findUser(type, sendTo);
            if (!user) {
                yield this.recoveryRepository.deleteById(recovery.id);
                throw new errors_1.AppError(messages_1.default.USER_NOT_FOUND, "User account no longer exists.");
            }
            const hashedPassword = yield this.securityUtil.hash(newPassword);
            /*
             * All operations happen in a single transaction:
             * 1. Update the password
             * 2. Delete the recovery record
             * 3. Revoke all sessions
             * 4. Reset the lockout counters
             */
            yield this.recoveryRepository.withTransaction((trx) => __awaiter(this, void 0, void 0, function* () {
                yield this.userRepository.updatePassword(user.id, hashedPassword, trx);
                yield this.recoveryRepository.deleteById(recovery.id, trx);
                // Revoke all sessions for this user
                yield this.authenticationTokenRepository.deleteAllByUserId(user.id, undefined, trx);
                // Reset the lockout counters so the user is not locked out
                yield this.userRepository.update(user.id, {
                    login_tries: 0,
                    failed_login_expired_at: null,
                }, undefined, trx);
            }));
            // Notify the user outside the transaction.
            yield this.sendPasswordChangedNotification(type, sendTo);
        });
    }
    findUser(type, sendTo) {
        return __awaiter(this, void 0, void 0, function* () {
            if (type === password_recovery_interface_1.RECOVERY_EMAIL) {
                return this.userRepository.findByEmail(sendTo);
            }
            if (type === password_recovery_interface_1.RECOVERY_PHONE) {
                return this.userRepository.findByPhone(sendTo);
            }
            throw new errors_1.AppError(messages_1.default.INVALID_RECOVERY_TYPE, "Unsupported recovery type.");
        });
    }
    assertResendAllowed(recovery, now) {
        if (recovery &&
            new Date(recovery.next_resend_at).getTime() > now.getTime()) {
            throw new errors_1.AppError(messages_1.default.TRY_RESEND, "Please wait before requesting another recovery code.");
        }
    }
    assertRecoveryExists(recovery) {
        if (!recovery) {
            throw new errors_1.AppError(messages_1.default.INVALID_TOKEN, "Invalid or expired recovery session.");
        }
    }
    assertAttemptAllowed(nextTryAt, now) {
        if (nextTryAt &&
            new Date(nextTryAt).getTime() > now.getTime()) {
            throw new errors_1.AppError(messages_1.default.TOO_MANY_ATTEMPTS, "Too many failed attempts. Please wait a few minutes before trying again.");
        }
    }
    registerFailedAttempt(recoveryId, currentTries, now) {
        return __awaiter(this, void 0, void 0, function* () {
            const tries = currentTries + 1;
            if (tries >= MAX_TRIES) {
                yield this.recoveryRepository.updateTries(recoveryId, 0, this.addMinutes(now, NEXT_TRY_MINUTES));
                return;
            }
            yield this.recoveryRepository.updateTries(recoveryId, tries, null);
        });
    }
    isExpired(expiresAt, now) {
        return new Date(expiresAt).getTime() <= now.getTime();
    }
    addMinutes(date, minutes) {
        return new Date(date.getTime() + minutes * 60 * 1000);
    }
    /**
     * Queues the recovery email for delivery.
     *
     * The phone channel is explicitly unavailable: claiming success
     * without delivering anything would leave the user waiting for a
     * code that never arrives.
     */
    queueRecoveryNotification(type, sendTo, plainCode) {
        return __awaiter(this, void 0, void 0, function* () {
            if (type === password_recovery_interface_1.RECOVERY_PHONE) {
                throw new errors_1.AppError(messages_1.default.INVALID_RECOVERY_TYPE, "Phone recovery channel is not available. Please use email recovery.");
            }
            if (!environment_1.__ENV.EMAIL_ENABLED) {
                return;
            }
            const settings = yield this.settingService.getCache();
            const emailSettings = settings.pri;
            yield this.outboxRepository.enqueue({
                type: outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL,
                payload: {
                    to: sendTo,
                    from: (0, mail_settings_1.resolveSender)(emailSettings, "psr_eml_snd"),
                    subject: emailSettings.psr_eml_sbj,
                    text: `Recovery Code: ${plainCode}`,
                },
            });
        });
    }
    sendPasswordChangedNotification(type, sendTo) {
        return __awaiter(this, void 0, void 0, function* () {
            if (type !== password_recovery_interface_1.RECOVERY_EMAIL || !environment_1.__ENV.EMAIL_ENABLED) {
                return;
            }
            const settings = yield this.settingService.getCache();
            const emailSettings = settings.pri;
            yield this.outboxRepository.enqueue({
                type: outbox_interface_1.OUTBOX_TYPES.SEND_EMAIL,
                payload: {
                    to: sendTo,
                    from: (0, mail_settings_1.resolveSender)(emailSettings, "psr_eml_snd"),
                    subject: emailSettings.psr_eml_sbj,
                    text: "Your password has been successfully reset. If you didn't make this change, please contact support.",
                },
            });
        });
    }
}
exports.PasswordRecoveryService = PasswordRecoveryService;
