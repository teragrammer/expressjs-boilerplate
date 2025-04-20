import {Knex} from "knex";
import {UserInterface} from "../../interfaces/user.interface";
import {AuthenticationTokenInterface} from "../../interfaces/authentication-token.interface";

declare global {
    namespace Express {
        interface Request {
            credentials: {
                user: UserInterface;
                authentication: AuthenticationTokenInterface;
            }; // Adding a custom property to Request
        }

        interface Application {
            knex: Knex,
            paginate: (req: Request) => { offset: number, perPage: number }
        }
    }
}