import {UserInterface} from "../../interfaces/user.interface";
import {AuthenticationTokenInterface} from "../../interfaces/authentication-token.interface";
import {JwtPayload} from "jsonwebtoken";

declare global {
    namespace Express {
        interface Request {
            credentials: {
                jwt: JwtPayload;
                user: () => Promise<UserInterface>;
                authentication: () => Promise<AuthenticationTokenInterface>;
            }; // Adding a custom property to Request
        }
    }
}