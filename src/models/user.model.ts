import {Knex} from "knex";

const TABLE_NAME = 'users';
export const STATUSES = ['Pending', 'Activated', 'Suspended', 'Deleted', 'Deactivated'];
export const GENDERS = ['Male', 'Female']

export function UserModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),
    }
}