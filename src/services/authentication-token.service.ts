import {UserInterface} from "../interfaces/user.interface";
import AuthenticationTokenRepository from "../repositories/authentication-token.repository";
import jwt from "jsonwebtoken";
import {JwtExtendedPayload} from "../models/authentication-token.model";
import {__ENV} from "../configurations/environment";
import {DateUtil} from "../utilities/date.util";
import {TFA_CONTINUE, TFA_HOLD} from "../models/two-factor-authentication.model";

const JWT_TFA = __ENV.JWT_TFA;
const JWT_SECRET = __ENV.JWT_SECRET;
const JWT_EXPIRATION_DAYS = __ENV.JWT_EXPIRATION_DAYS;

export interface AuthenticationMetaData {
    ip: string | null;
    browser: string | null;
    os: string | null;
}

class AuthenticationTokenService {
    private static instance: AuthenticationTokenService;

    private constructor() {
    }

    static getInstance(): AuthenticationTokenService {
        if (!AuthenticationTokenService.instance) AuthenticationTokenService.instance = new AuthenticationTokenService();
        return AuthenticationTokenService.instance;
    }

    async generate(user: UserInterface, metadata?: AuthenticationMetaData): Promise<string> {
        // delete expired tokens
        await this.clean(user.id);

        // generate a new token
        return await this.token(user, undefined, metadata);
    }

    clean(userId: number, expiredOnly: boolean = true) {
        if (expiredOnly) return AuthenticationTokenRepository.deleteExpiredByUserId(userId);
        return AuthenticationTokenRepository.deleteAllByUserId(userId);
    }

    async token(user: UserInterface, tfa?: string, metadata?: AuthenticationMetaData): Promise<string> {
        const EXPIRED_AT = DateUtil().expiredAt(JWT_EXPIRATION_DAYS / 86400, "days");
        const [ID] = await AuthenticationTokenRepository.insert({
            user_id: user.id,
            ip: metadata?.ip || null,
            browser: metadata?.browser || null,
            os: metadata?.os || null,
            created_at: DateUtil().sql(),
            expired_at: DateUtil().sql(EXPIRED_AT),
        });

        const PAYLOAD: JwtExtendedPayload = {
            uid: user.id,
            fnm: user.first_name,
            mnm: user.middle_name,
            lnm: user.last_name,
            rol: user.role_slug,
            unm: user.username,
            eml: user.email,
            phn: user.phone,
            bpa: user.role_is_bypass_authorization,
            tid: ID,
            tfa: tfa && [TFA_HOLD, TFA_CONTINUE].includes(tfa) ? tfa : (JWT_TFA ? TFA_HOLD : TFA_CONTINUE),
        };

        return jwt.sign(PAYLOAD, JWT_SECRET, {expiresIn: JWT_EXPIRATION_DAYS});
    }

    async validate(token: string): Promise<JwtExtendedPayload | boolean> {
        if (!token) return false;

        try {
            const DECODED = jwt.verify(token, JWT_SECRET);

            // Ensure it's a JwtExtendedPayload (not just a string)
            if (typeof DECODED === "object") return DECODED as JwtExtendedPayload;

            return false;
        } catch (error: any) {
            return false;
        }
    }
}

export default AuthenticationTokenService.getInstance();