import {Knex} from "knex";
import {UserInterface} from "../interfaces/user.interface";
import {DBKnex} from "../configurations/knex";

export const USER_TABLE = "users";

export const STATUSES = ["Pending", "Activated", "Suspended", "Deleted", "Deactivated"];
export const GENDERS = ["Male", "Female"];

export function UserModel(knex?: Knex) {
    return {
        table: () => (knex ? knex : DBKnex).table(USER_TABLE),

        hidden(user: UserInterface) {
            delete user.password;
            delete user.failed_login_expired_at;
            delete user.login_tries;
        },
    };
}