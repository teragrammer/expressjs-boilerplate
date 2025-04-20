import {Knex} from "knex";

const TABLE_NAME = 'roles';

export function RoleModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),
    }
}