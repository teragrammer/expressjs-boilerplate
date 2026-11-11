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
exports.AuthenticationRefreshController = void 0;
const catch_async_1 = __importDefault(require("../../../common/utils/catch-async"));
const audit_interface_1 = require("../../audit/audit.interface");
const refresh_token_cookie_1 = require("../../../common/utils/refresh-token-cookie");
const environment_1 = require("../../../config/environment");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
const request_info_1 = require("../../../common/utils/request-info");
const REFRESH_COOKIE_MAX_AGE_MS = Number(environment_1.__ENV.JWT_REFRESH_TOKEN_DAYS || 7) * 24 * 60 * 60 * 1000;
class AuthenticationRefreshController {
    constructor(sessionService, auditService) {
        this.sessionService = sessionService;
        this.auditService = auditService;
        /**
         * Exchanges a refresh token for a new access/refresh pair.
         *
         * The refresh token is read from the `HttpOnly` cookie. Rotation
         * is enforced: presenting an already-used token revokes the whole
         * family.
         */
        this.refresh = (0, catch_async_1.default)((req, res) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const refreshToken = (0, refresh_token_cookie_1.readRefreshTokenCookie)(req);
            if (!refreshToken) {
                throw new errors_1.AppError(messages_1.default.INVALID_TOKEN, "No refresh token was supplied.");
            }
            try {
                const issued = yield this.sessionService.rotate(refreshToken, {
                    ip: (0, request_info_1.getClientIp)(req),
                    userAgent: (_a = (0, request_info_1.getUserAgent)(req)) !== null && _a !== void 0 ? _a : null,
                });
                (0, refresh_token_cookie_1.setRefreshTokenCookie)(res, issued.refreshToken, REFRESH_COOKIE_MAX_AGE_MS);
                yield this.auditService.success(audit_interface_1.AUDIT_ACTIONS.AUTH_TOKEN_REFRESHED, { request: req });
                res.status(200).json({
                    token: issued.accessToken,
                    access_token: issued.accessToken,
                    expires_at: issued.expiresAt,
                });
            }
            catch (error) {
                yield this.auditService.failure(audit_interface_1.AUDIT_ACTIONS.AUTH_TOKEN_REUSE_DETECTED, {
                    request: req,
                    metadata: {
                        reason: error.message,
                    },
                });
                throw error;
            }
        }));
    }
}
exports.AuthenticationRefreshController = AuthenticationRefreshController;
