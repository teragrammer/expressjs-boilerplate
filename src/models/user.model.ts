import {Knex} from "knex";

const TABLE_NAME = 'users';
export const STATUSES = ['Pending', 'Activated', 'Suspended', 'Deleted', 'Deactivated'];

export function UserModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),
    }
}