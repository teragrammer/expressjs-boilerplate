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
exports.SessionService = void 0;
// src/modules/auth/authentication/session.service.ts
const node_crypto_1 = require("node:crypto");
const environment_1 = require("../../../config/environment");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
/**
 * Session and token issuing authority.
 *
 * Every token the application hands out is created here, which keeps a
 * single contract: an access token always references a live session
 * row, and the session row is the revocation authority.
 */
class SessionService {
    constructor(authenticationTokenRepository, refreshTokenRepository, tokenService, roleService, userRepository, dateUtil) {
        this.authenticationTokenRepository = authenticationTokenRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.tokenService = tokenService;
        this.roleService = roleService;
        this.userRepository = userRepository;
        this.dateUtil = dateUtil;
    }
    /**
     * Hashes a refresh token for storage.
     *
     * SHA-256 is appropriate here: the token is high-entropy random
     * data, not a low-entropy password, so a slow KDF is unnecessary.
     */
    hashRefreshToken(token) {
        return (0, node_crypto_1.createHash)("sha256").update(token).digest("hex");
    }
    /**
     * Creates a session and issues an access/refresh token pair.
     */
    issue(userId, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            const user = yield this.userRepository.findAuthById(userId);
            if (!user) {
                throw new errors_1.AppError(messages_1.default.DATA_NOT_FOUND);
            }
            const role = yield this.roleService.findById(user.role_id);
            const expiresAt = this.sessionExpiry();
            const session = yield this.authenticationTokenRepository.create({
                user_id: user.id,
                expired_at: expiresAt,
                ip: (_b = (_a = options.metadata) === null || _a === void 0 ? void 0 : _a.ip) !== null && _b !== void 0 ? _b : null,
                browser: (_d = (_c = options.metadata) === null || _c === void 0 ? void 0 : _c.browser) !== null && _d !== void 0 ? _d : null,
                os: (_f = (_e = options.metadata) === null || _e === void 0 ? void 0 : _e.os) !== null && _f !== void 0 ? _f : null,
            });
            const accessToken = this.tokenService.generateToken({
                uid: user.id,
                tid: session.id,
                tfa: options.tfa,
                rol: role.slug,
                bpa: role.is_bypass_authorization ? 1 : 0,
                av: user.authorization_version || 0,
            });
            const refreshToken = (0, node_crypto_1.randomBytes)(32).toString("base64url");
            yield this.refreshTokenRepository.create({
                session_id: session.id,
                user_id: user.id,
                token_hash: this.hashRefreshToken(refreshToken),
                family_id: (_g = options.familyId) !== null && _g !== void 0 ? _g : (0, node_crypto_1.randomUUID)(),
                expires_at: expiresAt,
                ip: (_j = (_h = options.metadata) === null || _h === void 0 ? void 0 : _h.ip) !== null && _j !== void 0 ? _j : null,
                user_agent: (_l = (_k = options.metadata) === null || _k === void 0 ? void 0 : _k.userAgent) !== null && _l !== void 0 ? _l : null,
            });
            return {
                accessToken,
                refreshToken,
                sessionId: session.id,
                expiresAt,
            };
        });
    }
    /**
     * Issues a fresh access token for an existing session.
     *
     * Used when a session's underlying data changed (profile update,
     * password change) but the session itself is retained or rotated.
     * The token always references the real session id.
     *
     * When `includeRefreshToken` is set, a new refresh token is issued
     * for the same session so the caller keeps a usable credential
     * pair.
     */
    issueForSession(sessionId, user, role, tfa, options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            const accessToken = this.tokenService.generateToken({
                uid: user.id,
                tid: sessionId,
                tfa,
                rol: role.slug,
                bpa: role.is_bypass_authorization ? 1 : 0,
                av: user.authorization_version || 0,
            });
            if (!(options === null || options === void 0 ? void 0 : options.includeRefreshToken)) {
                return {
                    accessToken,
                    refreshToken: "",
                    sessionId,
                    expiresAt: this.sessionExpiry(),
                };
            }
            const expiresAt = this.sessionExpiry();
            const refreshToken = (0, node_crypto_1.randomBytes)(32).toString("base64url");
            yield this.refreshTokenRepository.create({
                session_id: sessionId,
                user_id: user.id,
                token_hash: this.hashRefreshToken(refreshToken),
                family_id: (_a = options.familyId) !== null && _a !== void 0 ? _a : (0, node_crypto_1.randomUUID)(),
                expires_at: expiresAt,
                ip: (_c = (_b = options.metadata) === null || _b === void 0 ? void 0 : _b.ip) !== null && _c !== void 0 ? _c : null,
                user_agent: (_e = (_d = options.metadata) === null || _d === void 0 ? void 0 : _d.userAgent) !== null && _e !== void 0 ? _e : null,
            });
            return {
                accessToken,
                refreshToken,
                sessionId,
                expiresAt,
            };
        });
    }
    /**
     * Absolute expiry of a session row.
     */
    sessionExpiry() {
        return this.dateUtil.expiredAt(Number(environment_1.__ENV.JWT_REFRESH_TOKEN_DAYS || 7), "days");
    }
    /**
     * Rotates a refresh token.
     *
     * The presented token is revoked and replaced by a new one in the
     * same family. Presenting an already-used token means the family is
     * compromised, so the whole family is revoked.
     */
    rotate(presentedToken, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            const tokenHash = this.hashRefreshToken(presentedToken);
            const stored = yield this.refreshTokenRepository.findByHash(tokenHash);
            if (!stored) {
                throw new errors_1.AppError(messages_1.default.INVALID_TOKEN);
            }
            if (stored.revoked_at) {
                /*
                 * Reuse detection: a revoked token was presented again.
                 * Revoke the entire family.
                 */
                yield this.refreshTokenRepository.revokeFamily(stored.family_id);
                throw new errors_1.AppError(messages_1.default.INVALID_TOKEN, "The refresh token has already been used. All sessions in this family were revoked.");
            }
            if (new Date(stored.expires_at).getTime() <= Date.now()) {
                throw new errors_1.AppError(messages_1.default.EXPIRED_TOKEN);
            }
            /*
             * The session behind the refresh token must still be alive.
             */
            const session = yield this.authenticationTokenRepository.findById(stored.session_id, stored.user_id);
            if (!session) {
                throw new errors_1.AppError(messages_1.default.SESSION_EXPIRED);
            }
            const user = yield this.userRepository.findAuthById(stored.user_id);
            if (!user || user.status !== "Activated") {
                yield this.refreshTokenRepository.revokeFamily(stored.family_id);
                throw new errors_1.AppError(messages_1.default.SESSION_EXPIRED);
            }
            const role = yield this.roleService.findById(user.role_id);
            const expiresAt = this.dateUtil.expiredAt(Number(environment_1.__ENV.JWT_REFRESH_TOKEN_DAYS || 7), "days");
            const nextRefreshToken = (0, node_crypto_1.randomBytes)(32).toString("base64url");
            const created = yield this.refreshTokenRepository.create({
                session_id: stored.session_id,
                user_id: stored.user_id,
                token_hash: this.hashRefreshToken(nextRefreshToken),
                family_id: stored.family_id,
                expires_at: expiresAt,
                ip: (_a = metadata === null || metadata === void 0 ? void 0 : metadata.ip) !== null && _a !== void 0 ? _a : stored.ip,
                user_agent: (_b = metadata === null || metadata === void 0 ? void 0 : metadata.userAgent) !== null && _b !== void 0 ? _b : stored.user_agent,
            });
            yield this.refreshTokenRepository.revoke(stored.id, created.id);
            const accessToken = this.tokenService.generateToken({
                uid: user.id,
                tid: stored.session_id,
                tfa: true,
                rol: role.slug,
                bpa: role.is_bypass_authorization ? 1 : 0,
                av: user.authorization_version || 0,
            });
            return {
                accessToken,
                refreshToken: nextRefreshToken,
                sessionId: stored.session_id,
                expiresAt,
            };
        });
    }
    /**
     * Revokes the current session and its refresh token family.
     */
    revokeSession(sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.refreshTokenRepository.revokeBySessionId(sessionId);
            yield this.authenticationTokenRepository.deleteById(sessionId);
        });
    }
    /**
     * Revokes every session belonging to a user.
     */
    revokeAllSessions(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.refreshTokenRepository.revokeAllByUserId(userId);
            return this.authenticationTokenRepository.deleteAllByUserId(userId);
        });
    }
}
exports.SessionService = SessionService;
