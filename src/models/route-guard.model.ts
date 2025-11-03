import {Knex} from "knex";

const TABLE_NAME = "route_guards";

export const SET_CACHE_GUARDS = "set_cache_guards";
export const GET_CACHE_GUARDS = "get_cache_guards";

export function RouteGuardModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),
    };
}