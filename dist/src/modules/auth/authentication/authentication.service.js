"use strict";
// src/modules/auth/authentication/authentication.service.ts
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
exports.AuthenticationService = void 0;
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const database_1 = require("../../../config/database");
const metrics_1 = require("../../../common/metrics/metrics");
const environment_1 = require("../../../config/environment");
class AuthenticationService {
    constructor(securityUtil, authenticationTokenRepository, roleService, userService, userRepository, tokenService, dateUtil, settingService, tfaService, sessionService) {
        this.securityUtil = securityUtil;
        this.authenticationTokenRepository = authenticationTokenRepository;
        this.roleService = roleService;
        this.userService = userService;
        this.userRepository = userRepository;
        this.tokenService = tokenService;
        this.dateUtil = dateUtil;
        this.settingService = settingService;
        this.tfaService = tfaService;
        this.sessionService = sessionService;
    }
    /**
     * Executes the business workflow for registering a new customer.
     *
     * The user row and its session are created in a single transaction:
     * a failed session insert must not leave a half-registered account
     * that blocks a retry on the unique constraint.
     */
    register(data, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const role = yield this.roleService.getRoleBySlug("customer");
            if (!role) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND, "Default registration roles 'customer' could not be resolved.");
            }
            const hashedPassword = yield this.securityUtil.hash(data.password);
            const newUser = yield (0, database_1.withTransaction)((trx) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b, _c;
                const created = yield this.userService.registerUser(Object.assign(Object.assign({}, data), { password: hashedPassword, role_id: role.id, created_at: this.dateUtil.sql() }), trx);
                const session = yield this.authenticationTokenRepository.create({
                    user_id: created.id,
                    expired_at: this.dateUtil.expiredAt(Number(environment_1.__ENV.JWT_REFRESH_TOKEN_DAYS || 7), "days"),
                    ip: (_a = metadata === null || metadata === void 0 ? void 0 : metadata.ip) !== null && _a !== void 0 ? _a : null,
                    browser: (_b = metadata === null || metadata === void 0 ? void 0 : metadata.browser) !== null && _b !== void 0 ? _b : null,
                    os: (_c = metadata === null || metadata === void 0 ? void 0 : metadata.os) !== null && _c !== void 0 ? _c : null,
                }, trx);
                return { created, session };
            }));
            /*
             * The refresh token is issued after the transaction commits, so
             * a failure cannot leave a session without a credential pair.
             */
            const issued = yield this.sessionService.issueForSession(newUser.session.id, newUser.created, role, false, {
                includeRefreshToken: true,
                metadata: {
                    ip: (_a = metadata === null || metadata === void 0 ? void 0 : metadata.ip) !== null && _a !== void 0 ? _a : null,
                    userAgent: (_b = metadata === null || metadata === void 0 ? void 0 : metadata.userAgent) !== null && _b !== void 0 ? _b : null,
                },
            });
            metrics_1.authAttemptsTotal.inc({ event: "register", outcome: "success" });
            return {
                accessToken: issued.accessToken,
                refreshToken: issued.refreshToken,
                sessionId: newUser.session.id,
                expiresAt: issued.expiresAt,
                tfaRequired: false,
            };
        });
    }
    /**
     * Executes the business workflow for user login.
     */
    login(data, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.userRepository.findByUsername(data.username);
            // Mitigate Username Enumeration. If user is missing, skip to generic fail block.
            if (!user) {
                // Perform a dummy comparison to reduce timing-based user enumeration.
                yield this.securityUtil.compare("$2b$12$00000000000000000000000000000000000000000000000000000", data.password);
                metrics_1.authAttemptsTotal.inc({ event: "login", outcome: "failure" });
                this.handleFailedLogin();
            }
            // Enforce account status - only Activated users can authenticate
            if (user.status !== "Activated") {
                metrics_1.authAttemptsTotal.inc({ event: "login", outcome: "failure" });
                // Don't reveal the specific status, use generic error
                this.handleFailedLogin();
            }
            if (typeof user.password === "undefined" || user.password === null) {
                throw new errors_1.AppError(messages_1.default.INCORRECT_PASS_SETUP);
            }
            // Account Lockout verification check
            const expiredAt = user.failed_login_expired_at;
            if (expiredAt) {
                const isLockoutActive = !this.dateUtil.isPast(expiredAt);
                if (isLockoutActive) {
                    metrics_1.authAttemptsTotal.inc({ event: "login", outcome: "locked" });
                    throw new errors_1.AppError(messages_1.default.TOO_MANY_ATTEMPTS);
                }
                // Lockout has expired: Reset tracking
                yield this.userRepository.update(user.id, {
                    failed_login_expired_at: null,
                    login_tries: 0,
                });
            }
            // Perform constant-time hash comparison
            const isPasswordMatch = yield this.securityUtil.compare(user.password, data.password);
            if (!isPasswordMatch) {
                const updatedUser = yield this.userRepository.incrementLoginTries(user.id);
                const settings = yield this.settingService.getCache();
                const totalLoginTries = Number((updatedUser === null || updatedUser === void 0 ? void 0 : updatedUser.login_tries) || 0);
                if (totalLoginTries >= settings.pri.mx_log_try) {
                    yield this.userRepository.update(user.id, {
                        failed_login_expired_at: this.dateUtil.expiredAt(settings.pri.lck_prd, "minutes"),
                    });
                    metrics_1.authAttemptsTotal.inc({ event: "login", outcome: "locked" });
                    throw new errors_1.AppError(messages_1.default.LOCKED_ACCOUNT);
                }
                metrics_1.authAttemptsTotal.inc({ event: "login", outcome: "failure" });
                this.handleFailedLogin();
            }
            // Reset login tries on successful login
            if (user.login_tries > 0 || user.failed_login_expired_at) {
                yield this.userRepository.update(user.id, {
                    login_tries: 0,
                    failed_login_expired_at: null,
                });
            }
            // Check if TFA is required for this user
            const tfaRequired = yield this.tfaService.isTfaRequired(user);
            // purge expired tokens
            yield this.authenticationTokenRepository.purgeExpiredTokensByUserId(user.id);
            /*
             * Issue the credential pair through the single session
             * authority so every token references a live session row.
             */
            const issued = yield this.sessionService.issue(user.id, {
                tfa: !tfaRequired,
                metadata,
            });
            metrics_1.authAttemptsTotal.inc({ event: "login", outcome: "success" });
            return Object.assign(Object.assign({}, issued), { tfaRequired });
        });
    }
    /**
     * Handles authentication session termination securely.
     */
    logout(tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const isDeleted = yield this.authenticationTokenRepository.deleteById(tid);
            if (!isDeleted) {
                throw new errors_1.AppError(messages_1.default.DELETE_FAILED);
            }
        });
    }
    /**
     * Revokes every session belonging to a user.
     */
    logoutAll(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sessionService.revokeAllSessions(userId);
        });
    }
    /**
     * Helper to guarantee consistent, generic error responses for failed logins.
     */
    handleFailedLogin() {
        throw new errors_1.AppError(messages_1.default.CREDENTIAL_DO_NOT_MATCH, "Invalid username or password details.");
    }
    /**
     * Resolves the session referenced by an access token.
     *
     * Fails when the session is gone, expired, or belongs to a
     * different user.
     */
    findAuthenticationToken(payload) {
        return __awaiter(this, void 0, void 0, function* () {
            const session = yield this.authenticationTokenRepository.findById(payload.tid, payload.uid);
            if (!session) {
                throw new errors_1.AppError(messages_1.default.SESSION_EXPIRED, "Active token session not found.");
            }
            /*
             * Check that the authorization version still matches.
             *
             * A role, status or permission change increments the user's
             * authorization version, which invalidates tokens issued before
             * the change without waiting for expiry.
             */
            const user = yield this.userRepository.findAuthById(payload.uid);
            if (!user) {
                throw new errors_1.AppError(messages_1.default.SESSION_EXPIRED, "Active token session not found.");
            }
            if (user.status !== "Activated") {
                throw new errors_1.AppError(messages_1.default.SESSION_EXPIRED, "Active token session not found.");
            }
            if (payload.av !== undefined &&
                user.authorization_version !== payload.av) {
                throw new errors_1.AppError(messages_1.default.SESSION_EXPIRED, "Authorization has changed. Please log in again.");
            }
            return session;
        });
    }
}
exports.AuthenticationService = AuthenticationService;
