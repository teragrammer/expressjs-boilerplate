"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenService = exports.JWT_ALGORITHM = void 0;
// src/modules/auth/authentication/authentication-token.service.ts
const node_crypto_1 = require("node:crypto");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const environment_1 = require("../../../config/environment");
const errors_1 = require("../../../common/utils/errors");
const messages_1 = __importDefault(require("../../../common/utils/messages"));
/**
 * The only accepted JWT signing algorithm.
 *
 * Pinning the algorithm prevents algorithm-confusion attacks, where a
 * token signed with `none` or an asymmetric algorithm is accepted by a
 * service that expects HMAC.
 */
exports.JWT_ALGORITHM = "HS256";
class TokenService {
    constructor(secret = environment_1.__ENV.JWT_SECRET, accessTokenMinutes = environment_1.__ENV.JWT_ACCESS_TOKEN_MINUTES, issuer = environment_1.__ENV.JWT_ISSUER, audience = environment_1.__ENV.JWT_AUDIENCE) {
        this.secret = secret;
        this.accessTokenMinutes = accessTokenMinutes;
        this.issuer = issuer;
        this.audience = audience;
    }
    /**
     * Signs a short-lived access token.
     *
     * Every token carries the session id (`tid`), the user id (`uid`),
     * the current role and authorization version, the TFA state, and
     * the standard `iss`/`aud`/`jti` claims.
     */
    generateToken(claims) {
        try {
            const options = {
                algorithm: exports.JWT_ALGORITHM,
                expiresIn: `${this.accessTokenMinutes}m`,
                issuer: this.issuer,
                audience: this.audience,
                subject: String(claims.uid),
                jwtid: (0, node_crypto_1.randomUUID)(),
            };
            return jsonwebtoken_1.default.sign({
                uid: claims.uid,
                tid: claims.tid,
                tfa: claims.tfa,
                rol: claims.rol,
                bpa: claims.bpa,
                av: claims.av,
            }, this.secret, options);
        }
        catch (error) {
            throw new errors_1.AppError(messages_1.default.SERVER_ERROR);
        }
    }
    /**
     * Verifies and decodes an incoming access token.
     *
     * The algorithm, issuer and audience are all validated; a token
     * missing any of them is rejected.
     */
    verifyToken(token) {
        try {
            const options = {
                algorithms: [exports.JWT_ALGORITHM],
                issuer: this.issuer,
                audience: this.audience,
            };
            const decoded = jsonwebtoken_1.default.verify(token, this.secret, options);
            return {
                uid: decoded.uid,
                tid: decoded.tid,
                tfa: decoded.tfa,
                rol: decoded.rol,
                bpa: decoded.bpa,
                av: decoded.av,
                jti: decoded.jti,
                iss: decoded.iss,
                aud: decoded.aud,
            };
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
                throw new errors_1.AppError(messages_1.default.EXPIRED_AUTH_TOKEN);
            }
            throw new errors_1.AppError(messages_1.default.INVALID_AUTH_TOKEN);
        }
    }
    /**
     * Access token lifetime in minutes.
     */
    get accessTokenLifetimeMinutes() {
        return this.accessTokenMinutes;
    }
}
exports.TokenService = TokenService;
