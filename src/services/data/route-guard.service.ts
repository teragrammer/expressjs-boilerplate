import {Knex} from "knex";
import {RoleInterface} from "../../interfaces/role.interface";
import {RoleModel} from "../../models/role.model";
import {RouteGuardInterface} from "../../interfaces/route-guard.interface";
import {RouteGuardModel, SET_CACHE_GUARDS} from "../../models/route-guard.model";
import {Application} from "express";
import {IS_REDIS_CONNECTION_ACTIVE} from "../redis/redis-publisher.service";
import {__ENV} from "../../configurations/environment";

const INITIALIZER = async (knex: Knex): Promise<Record<string, string[]>> => {
    const GUARDS: Record<string, string[]> = {};

    const ROLES: RoleInterface[] = await RoleModel(knex).table().select(["id", "slug"]);
    for (const role of ROLES) {
        const ROUTE_GUARDS: RouteGuardInterface[] = await RouteGuardModel(knex).table().select(["route"]).where("role_id", role.id);
        for (const routeGuard of ROUTE_GUARDS) {
            if (typeof GUARDS[role.slug] === "undefined") GUARDS[role.slug] = [];
            GUARDS[role.slug].push(routeGuard.route);
        }
    }

    return GUARDS;
};

const GET_CACHED_GUARDS = async (app: Application): Promise<Readonly<Record<string, string[]>>> => {
    const CACHE = app.get(SET_CACHE_GUARDS);
    if (CACHE) return CACHE();

    const GUARDS: Record<string, string[]> = await INITIALIZER(app.get("knex"));
    app.set(SET_CACHE_GUARDS, (): Readonly<any> => Object.freeze(GUARDS));

    return Object.freeze(GUARDS);
};

const CACHING = async (app: Application): Promise<Readonly<Record<string, string[]>>> => {
    if (!IS_REDIS_CONNECTION_ACTIVE(app) && __ENV.CLUSTER) return Object.freeze(INITIALIZER(app.get("knex")));

    return GET_CACHED_GUARDS(app);
};

export const RouteGuardService = () => {
    return {
        initializer: INITIALIZER,
        caching: CACHING,
    };
};