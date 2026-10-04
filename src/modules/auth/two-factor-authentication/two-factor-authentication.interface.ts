// src/modules/auth/two-factor-authentication/two-factor-authentication.interface.ts
import {User} from "../../users/user.interface";

export interface TwoFactorAuthentication {
    id: number;
    token_id: number | null;
    code: string;
    tries: number;
    next_send_at: string | Date | null;
    expired_tries_at: string | Date | null;
    expired_at: string | Date | null;
    created_at: string | Date;
    updated_at: string | Date;
}

export interface SendOtpInput {
    tokenId: number;
    email?: string;
    tfaCleared: boolean;
}

export interface SendOtpResult {
    id: number;
    nextTry: string;
}

export interface VerifyOtpInput {
    tokenId: number;
    code: string;
    user: User;
    tfaCleared: boolean;
    meta: {
        ip: string | null;
        browser: string | null;
        os: string | null;
    };
}
