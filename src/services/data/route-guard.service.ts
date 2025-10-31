import {Knex} from "knex";
import {RoleInterface} from "../../interfaces/role.interface";
import {RoleModel} from "../../models/role.model";
import {RouteGuardInterface} from "../../interfaces/route-guard.interface";
import {RouteGuardModel} from "../../models/route-guard.model";

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
}

export const RouteGuardService = () => {
    return {
        initializer: INITIALIZER,
    };
};