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
exports.AuthenticationController = void 0;
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const request_credentials_1 = require("../../../common/utils/request-credentials");
const refresh_token_cookie_1 = require("../../../common/utils/refresh-token-cookie");
const environment_1 = require("../../../config/environment");
const audit_interface_1 = require("../../audit/audit.interface");
const request_info_1 = require("../../../common/utils/request-info");
/**
 * Refresh token lifetime in milliseconds.
 */
const REFRESH_COOKIE_MAX_AGE_MS = Number(environment_1.__ENV.JWT_REFRESH_TOKEN_DAYS || 7) * 24 * 60 * 60 * 1000;
class AuthenticationController {
    constructor(authService, sessionService, refreshTokenRepository, auditService) {
        this.authService = authService;
        this.sessionService = sessionService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.auditService = auditService;
        this.login = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            // Delegate to Business Service
            const result = yield this.authService.login(req.sanitize.data, Object.assign(Object.assign({ ip: (0, request_info_1.getClientIp)(req) }, (0, request_info_1.getUserAgentInfo)(req)), { userAgent: (_a = (0, request_info_1.getUserAgent)(req)) !== null && _a !== void 0 ? _a : null }));
            if (result.refreshToken) {
                (0, refresh_token_cookie_1.setRefreshTokenCookie)(res, result.refreshToken, REFRESH_COOKIE_MAX_AGE_MS);
            }
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.AUTH_LOGIN_SUCCEEDED, {
                request: req,
                actorUserId: (_b = result.userId) !== null && _b !== void 0 ? _b : null,
                targetType: "user",
                targetId: (_c = result.userId) !== null && _c !== void 0 ? _c : null,
            });
            res.status(200).json({
                token: result.accessToken,
                access_token: result.accessToken,
                expires_at: result.expiresAt,
                tfa_required: Boolean(result.tfaRequired),
                tfaRequired: Boolean(result.tfaRequired),
            });
        }));
        this.logout = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            yield this.authService.logout(req.credentials.jwt.tid);
            (0, refresh_token_cookie_1.clearRefreshTokenCookie)(res);
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.AUTH_LOGOUT, {
                request: req,
            });
            res.sendStatus(204);
        }));
        /**
         * Revokes every session belonging to the caller.
         */
        this.logoutAll = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const revoked = yield this.authService.logoutAll(req.credentials.jwt.uid);
            (0, refresh_token_cookie_1.clearRefreshTokenCookie)(res);
            yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.AUTH_LOGOUT_ALL, {
                request: req,
                metadata: { revokedSessions: revoked },
            });
            res.sendStatus(204);
        }));
        /**
         * Lists the caller's active sessions.
         */
        this.sessions = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            (0, request_credentials_1.assertCredentials)(req);
            const sessions = yield this.refreshTokenRepository.findActiveByUserId(req.credentials.jwt.uid);
            res.status(200).json({
                sessions: sessions.map((session) => ({
                    id: session.id,
                    session_id: session.session_id,
                    ip: session.ip,
                    user_agent: session.user_agent,
                    created_at: session.created_at,
                    expires_at: session.expires_at,
                })),
            });
        }));
    }
}
exports.AuthenticationController = AuthenticationController;
