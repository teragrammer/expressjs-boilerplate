// src/modules/auth/authentication/session.service.ts
import {createHash, randomBytes, randomUUID} from "node:crypto";
import {__ENV} from "../../../config/environment";
import {AppError} from "../../../common/utils/errors";
import Messages from "../../../common/utils/messages";
import {DateUtil} from "../../../common/utils/date.util";
import {AuthenticationTokenRepository} from "./authentication-token.repository";
import {RefreshTokenRepository} from "./refresh-token.repository";
import {TokenService} from "./authentication-token.service";
import {RoleService} from "../../system/roles/role.service";
import {UserRepository} from "../../users/user.repository";
import {
    withTransaction,
    type DatabaseExecutor,
} from "../../../config/database";
import type {Transaction} from "kysely";
import type {Database} from "../../../config/schema";

/**
 * Internal signal used when another request already rotated the token.
 */
class RefreshTokenAlreadyRotatedError extends Error {
}

/**
 * A freshly issued credential pair.
 */
export interface IssuedTokens {
    /** Short-lived access token (JWT). */
    accessToken: string;
    /** Opaque refresh token; only its hash is persisted. */
    refreshToken: string;
    /** Session row id the access token references. */
    sessionId: number;
    /** Absolute expiry of the refresh token / session. */
    expiresAt: Date;
}

export interface SessionMetadata {
    ip?: string | null;
    browser?: string | null;
    os?: string | null;
    userAgent?: string | null;
}

/**
 * Session and token issuing authority.
 *
 * Every token the application hands out is created here, which keeps a
 * single contract: an access token always references a live session
 * row, and the session row is the revocation authority.
 */
export class SessionService {
    constructor(
        private readonly authenticationTokenRepository: AuthenticationTokenRepository,
        private readonly refreshTokenRepository: RefreshTokenRepository,
        private readonly tokenService: TokenService,
        private readonly roleService: RoleService,
        private readonly userRepository: UserRepository,
        private readonly dateUtil: DateUtil,
        private readonly runInTransaction: <T>(
            callback: (trx: Transaction<Database>) => Promise<T>,
        ) => Promise<T> = withTransaction,
    ) {
    }

    /**
     * Hashes a refresh token for storage.
     *
     * SHA-256 is appropriate here: the token is high-entropy random
     * data, not a low-entropy password, so a slow KDF is unnecessary.
     */
    private hashRefreshToken(token: string): string {
        return createHash("sha256").update(token).digest("hex");
    }

    /**
     * Creates a session and issues an access/refresh token pair.
     */
    async issue(
        userId: number,
        options: {
            tfa: boolean;
            metadata?: SessionMetadata;
            familyId?: string;
        },
    ): Promise<IssuedTokens> {
        const user = await this.userRepository.findAuthById(userId);

        if (!user) {
            throw new AppError(Messages.DATA_NOT_FOUND);
        }

        const role = await this.roleService.findById(user.role_id);

        const expiresAt = this.sessionExpiry();

        const session = await this.authenticationTokenRepository.create({
            user_id: user.id,
            expired_at: expiresAt,
            ip: options.metadata?.ip ?? null,
            browser: options.metadata?.browser ?? null,
            os: options.metadata?.os ?? null,
            tfa_verified: options.tfa,
        });

        const accessToken = this.tokenService.generateToken({
            uid: user.id,
            tid: session.id,
            tfa: options.tfa,
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: user.authorization_version || 0,
        });

        /*
         * A refresh token must not be usable before the second factor
         * is complete: otherwise `/auth/refresh` would be a TFA
         * bypass. Pending-TFA sessions therefore receive only the
         * short-lived access token.
         */
        if (!options.tfa) {
            return {
                accessToken,
                refreshToken: "",
                sessionId: session.id,
                expiresAt,
            };
        }

        const refreshToken = randomBytes(32).toString("base64url");

        await this.refreshTokenRepository.create({
            session_id: session.id,
            user_id: user.id,
            token_hash: this.hashRefreshToken(refreshToken),
            family_id: options.familyId ?? randomUUID(),
            expires_at: expiresAt,
            ip: options.metadata?.ip ?? null,
            user_agent: options.metadata?.userAgent ?? null,
        });

        return {
            accessToken,
            refreshToken,
            sessionId: session.id,
            expiresAt,
        };
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
    async issueForSession(
        sessionId: number,
        user: {id: number; authorization_version?: number},
        role: {slug: string; is_bypass_authorization: boolean},
        tfa: boolean,
        options?: {
            includeRefreshToken?: boolean;
            familyId?: string;
            metadata?: SessionMetadata;
            executor?: DatabaseExecutor;
        },
    ): Promise<IssuedTokens> {
        const accessToken = this.tokenService.generateToken({
            uid: user.id,
            tid: sessionId,
            tfa,
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: user.authorization_version || 0,
        });

        if (!options?.includeRefreshToken) {
            return {
                accessToken,
                refreshToken: "",
                sessionId,
                expiresAt: this.sessionExpiry(),
            };
        }

        const expiresAt = this.sessionExpiry();
        const refreshToken = randomBytes(32).toString("base64url");

        await this.refreshTokenRepository.create({
            session_id: sessionId,
            user_id: user.id,
            token_hash: this.hashRefreshToken(refreshToken),
            family_id: options.familyId ?? randomUUID(),
            expires_at: expiresAt,
            ip: options.metadata?.ip ?? null,
            user_agent: options.metadata?.userAgent ?? null,
        }, options.executor);

        return {
            accessToken,
            refreshToken,
            sessionId,
            expiresAt,
        };
    }

    /**
     * Absolute expiry of a session row.
     */
    private sessionExpiry(): Date {
        return this.dateUtil.expiredAt(
            Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7),
            "days",
        );
    }

    /**
     * Rotates a refresh token.
     *
     * The presented token is revoked and replaced by a new one in the
     * same family. Presenting an already-used token means the family is
     * compromised, so the whole family is revoked.
     */
    async rotate(
        presentedToken: string,
        metadata?: SessionMetadata,
    ): Promise<IssuedTokens> {
        const tokenHash = this.hashRefreshToken(presentedToken);
        const stored = await this.refreshTokenRepository.findByHash(
            tokenHash,
        );

        if (!stored) {
            throw new AppError(Messages.INVALID_TOKEN);
        }

        if (stored.revoked_at) {
            /*
             * Reuse detection: a revoked token was presented again.
             * Revoke the entire family.
             */
            await this.refreshTokenRepository.revokeFamily(
                stored.family_id,
            );

            throw new AppError(
                Messages.INVALID_TOKEN,
                "The refresh token has already been used. All sessions in this family were revoked.",
            );
        }

        if (new Date(stored.expires_at).getTime() <= Date.now()) {
            throw new AppError(Messages.EXPIRED_TOKEN);
        }

        /*
         * The session behind the refresh token must still be alive.
         */
        const session = await this.authenticationTokenRepository.findById(
            stored.session_id,
            stored.user_id,
        );

        if (!session) {
            throw new AppError(Messages.SESSION_EXPIRED);
        }

        const user = await this.userRepository.findAuthById(stored.user_id);

        if (!user || user.status !== "Activated") {
            await this.refreshTokenRepository.revokeFamily(
                stored.family_id,
            );

            throw new AppError(Messages.SESSION_EXPIRED);
        }

        const role = await this.roleService.findById(user.role_id);

        const expiresAt = this.dateUtil.expiredAt(
            Number(__ENV.JWT_REFRESH_TOKEN_DAYS || 7),
            "days",
        );

        const nextRefreshToken = randomBytes(32).toString("base64url");

        const accessToken = this.tokenService.generateToken({
            uid: user.id,
            tid: stored.session_id,
            /*
             * Preserve the durable session state. Hardcoding `true`
             * here would let a pre-TFA refresh token bypass the second
             * factor.
             */
            tfa: Boolean(session.tfa_verified),
            rol: role.slug,
            bpa: role.is_bypass_authorization ? 1 : 0,
            av: user.authorization_version || 0,
        });

        try {
            /*
             * Claiming and creating the successor are one unit of work.
             * The conditional UPDATE is the atomic gate: if two
             * requests present the same token, only one transitions it
             * from active to revoked and therefore only one creates a
             * successor.
             */
            await this.runInTransaction(async (trx) => {
                const claimed = await this.refreshTokenRepository
                    .claimForRotation(tokenHash, trx);

                if (!claimed) {
                    throw new RefreshTokenAlreadyRotatedError();
                }

                const created = await this.refreshTokenRepository.create({
                    session_id: stored.session_id,
                    user_id: stored.user_id,
                    token_hash: this.hashRefreshToken(nextRefreshToken),
                    family_id: stored.family_id,
                    expires_at: expiresAt,
                    ip: metadata?.ip ?? stored.ip,
                    user_agent: metadata?.userAgent ?? stored.user_agent,
                }, trx);

                await this.refreshTokenRepository.markReplacedBy(
                    claimed.id,
                    created.id,
                    trx,
                );
            });
        } catch (error) {
            if (error instanceof RefreshTokenAlreadyRotatedError) {
                /*
                 * A concurrent rotation already consumed this token.
                 * Treat it as reuse and revoke the whole family so a
                 * stolen token cannot be forked into two live branches.
                 */
                await this.refreshTokenRepository.revokeFamily(
                    stored.family_id,
                );

                throw new AppError(
                    Messages.INVALID_TOKEN,
                    "The refresh token has already been used. All sessions in this family were revoked.",
                );
            }

            throw error;
        }

        return {
            accessToken,
            refreshToken: nextRefreshToken,
            sessionId: stored.session_id,
            expiresAt,
        };
    }

    /**
     * Revokes the current session and its refresh token family.
     */
    async revokeSession(sessionId: number): Promise<void> {
        await this.refreshTokenRepository.revokeBySessionId(sessionId);
        await this.authenticationTokenRepository.deleteById(sessionId);
    }

    /**
     * Revokes every session belonging to a user.
     */
    async revokeAllSessions(userId: number): Promise<number> {
        await this.refreshTokenRepository.revokeAllByUserId(userId);

        return this.authenticationTokenRepository.deleteAllByUserId(userId);
    }
}
