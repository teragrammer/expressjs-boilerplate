import {Knex} from "knex";
import {DBKnex} from "../configurations/knex";

export const ROUTE_GUARD_TABLE = "route_guards";

export const SET_CACHE_GUARDS = "set_cache_guards";

export function RouteGuardModel(knex?: Knex) {
    return {
        table: () => (knex ? knex : DBKnex).table(ROUTE_GUARD_TABLE),
    };
}