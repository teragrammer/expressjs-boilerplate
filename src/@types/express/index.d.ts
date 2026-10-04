// src/@types/express/index.d.ts
import "express-useragent";
import {AuthenticationToken} from "../../modules/auth/authentication/authentication.interface";
import {JwtExtendedPayload} from "../../modules/auth/authentication/authentication.interface";
import {User} from "../../modules/users/user.interface";

export interface RequestCredentials {
    jwt: JwtExtendedPayload;
    user: () => Promise<User>;
    authentication: () => Promise<AuthenticationToken>;
}

export interface SanitizerHelper {
    get: <T = unknown>(
        key: string,
        defaults?: T,
    ) => T;

    only: <
        T extends Record<string, unknown> = Record<string, unknown>
    >(
        keys: string[],
        defaults?: Partial<T>,
    ) => T;

    numeric: (
        key: string,
        defaults?: number,
    ) => number;
}

export interface RequestSanitize {
    body: SanitizerHelper;
    query: SanitizerHelper;
    data: Record<string, unknown>;
}

export interface ResponseFailed {
    message: (
        status: number,
        message?: string,
        code?: string,
    ) => void;

    fields: (
        status: number,
        errors: Record<string, unknown> | unknown[],
    ) => void;
}

/**
 * Traditional page/offset pagination.
 */
export interface RequestPagination {
    page: number;
    offset: number;
    perPage: number;
}

/**
 * Cursor pagination for high-volume endpoints.
 */
export interface RequestCursorPagination {
    cursor?: number;
    perPage: number;
}

declare global {
    namespace Express {
        interface Request {
            /**
             * Authentication credentials.
             *
             * Undefined when the request has no authenticated
             * user or the authentication middleware has not
             * populated the credentials.
             */
            credentials?: RequestCredentials;

            sanitize: RequestSanitize;

            /**
             * Existing offset pagination.
             */
            pagination: RequestPagination;

            /**
             * Cursor pagination.
             */
            cursorPagination: RequestCursorPagination;
        }

        interface Response {
            failed: ResponseFailed;
        }
    }
}
