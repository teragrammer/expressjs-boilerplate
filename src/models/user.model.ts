import {Knex} from "knex";
import {UserInterface} from "../interfaces/user.interface";

const TABLE_NAME = "users";

export const STATUSES = ["Pending", "Activated", "Suspended", "Deleted", "Deactivated"];
export const GENDERS = ["Male", "Female"];

export function UserModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),

        profile: async (id: number): Promise<UserInterface> => {
            return knex.table(TABLE_NAME)
                .select([
                    "users.*",
                    "roles.slug AS role_slug", "roles.is_public AS role_is_public"
                ])
                .leftJoin("roles", "users.role_id", "=", "roles.id")
                .where("users.id", id)
                .first();
        },
    };
}