// src/modules/auth/authentication/authentication-token.service.ts
import {randomUUID} from "node:crypto";
import jwt, {SignOptions, VerifyOptions} from "jsonwebtoken";
import {__ENV} from "../../../config/environment";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {JwtExtendedPayload} from "./authentication.interface";

/**
 * The only accepted JWT signing algorithm.
 *
 * Pinning the algorithm prevents algorithm-confusion attacks, where a
 * token signed with `none` or an asymmetric algorithm is accepted by a
 * service that expects HMAC.
 */
export const JWT_ALGORITHM = "HS256" as const;

export interface AccessTokenClaims {
    uid: number;
    tid: number;
    tfa: boolean;
    rol?: string;
    bpa?: number;
    av?: number;
}

export class TokenService {
    private readonly secret: string;
    private readonly accessTokenMinutes: number;
    private readonly issuer: string;
    private readonly audience: string;

    constructor(
        secret: string = __ENV.JWT_SECRET,
        accessTokenMinutes: number = __ENV.JWT_ACCESS_TOKEN_MINUTES,
        issuer: string = __ENV.JWT_ISSUER,
        audience: string = __ENV.JWT_AUDIENCE,
    ) {
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
    public generateToken(claims: AccessTokenClaims): string {
        try {
            const options: SignOptions = {
                algorithm: JWT_ALGORITHM,
                expiresIn: `${this.accessTokenMinutes}m`,
                issuer: this.issuer,
                audience: this.audience,
                subject: String(claims.uid),
                jwtid: randomUUID(),
            };

            return jwt.sign(
                {
                    uid: claims.uid,
                    tid: claims.tid,
                    tfa: claims.tfa,
                    rol: claims.rol,
                    bpa: claims.bpa,
                    av: claims.av,
                },
                this.secret,
                options,
            );
        } catch (error: any) {
            throw new AppError(Messages.SERVER_ERROR);
        }
    }

    /**
     * Verifies and decodes an incoming access token.
     *
     * The algorithm, issuer and audience are all validated; a token
     * missing any of them is rejected.
     */
    public verifyToken(token: string): JwtExtendedPayload {
        try {
            const options: VerifyOptions = {
                algorithms: [JWT_ALGORITHM],
                issuer: this.issuer,
                audience: this.audience,
            };

            const decoded = jwt.verify(
                token,
                this.secret,
                options,
            ) as jwt.JwtPayload & JwtExtendedPayload;

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
        } catch (error: any) {
            if (error instanceof jwt.TokenExpiredError) {
                throw new AppError(Messages.EXPIRED_AUTH_TOKEN);
            }

            throw new AppError(Messages.INVALID_AUTH_TOKEN);
        }
    }

    /**
     * Access token lifetime in minutes.
     */
    public get accessTokenLifetimeMinutes(): number {
        return this.accessTokenMinutes;
    }
}
