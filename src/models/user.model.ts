import {Knex} from "knex";
import {UserInterface} from "../interfaces/user.interface";
import {RoleModel} from "./role.model";

const TABLE_NAME = 'users';
export const STATUSES = ['Pending', 'Activated', 'Suspended', 'Deleted', 'Deactivated'];
export const GENDERS = ['Male', 'Female']

export function UserModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),

        profile: async (id: number): Promise<UserInterface> => {
            const user: UserInterface = await knex.table(TABLE_NAME).where('id', id).first();
            if (user) user.role = await RoleModel(knex).table().where('id', user.role_id).first();
            return user;
        }
    }
}