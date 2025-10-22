import {UserInterface} from "../../interfaces/user.interface";
import {AuthenticationTokenInterface} from "../../interfaces/authentication-token.interface";
import {JwtExtendedPayload} from "../../models/authentication-token.model";

declare global {
    namespace Express {
        interface Request {
            credentials: {
                jwt: JwtExtendedPayload;
                user: () => Promise<UserInterface>;
                authentication: () => Promise<AuthenticationTokenInterface>;
            };

            sanitize: {
                body: {
                    get: (key: string, defaults?: any) => any;
                    only: (keys: string[]) => Record<string, any>;
                    numeric: (key: string, defaults?: any) => any;
                },
                query: {
                    get: (key: string, defaults?: any) => any;
                    numeric: (key: string, defaults?: any) => any;
                }
            };
        }
    }
}