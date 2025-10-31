import {Knex} from "knex";

const TABLE_NAME = "route_guards";

export const CACHE_GUARD_NAME = "cache_guards";

export function RouteGuardModel(knex: Knex) {
    return {
        table: () => knex.table(TABLE_NAME),
    };
}