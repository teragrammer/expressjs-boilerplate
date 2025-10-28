import {Knex} from "knex";
import {SecurityUtil} from "../../src/utilities/security.util";

export async function seed(knex: Knex): Promise<void> {
    // Insert roles
    const ADMIN_ROLE = await knex("roles").insert({name: 'Administrator', slug: 'admin', is_public: 0}).returning('id');
    const MANAGER_ROLE = await knex("roles").insert({name: 'Manager', slug: 'manager', is_public: 0}).returning('id');
    const CUSTOMER_ROLE = await knex("roles").insert({name: 'Customer', slug: 'customer', is_public: 0}).returning('id');

    // Inserts users
    const PASSWORD = await SecurityUtil().hash("123456");
    await knex("users").insert([
        {username: "admin", PASSWORD, role_id: ADMIN_ROLE[0]},
        {username: "manager", PASSWORD, role_id: MANAGER_ROLE[0]},
        {username: "customer", PASSWORD, role_id: CUSTOMER_ROLE[0]},
    ]);

    // Admin route guards
    await knex("route_guards").insert([
        {route: "settings:browse", role_id: ADMIN_ROLE[0]},
        {route: "settings:view", role_id: ADMIN_ROLE[0]},
        {route: "settings:create", role_id: ADMIN_ROLE[0]},
        {route: "settings:update", role_id: ADMIN_ROLE[0]},
        {route: "settings:delete", role_id: ADMIN_ROLE[0]},

        {route: "roles:browse", role_id: ADMIN_ROLE[0]},
        {route: "roles:view", role_id: ADMIN_ROLE[0]},
        {route: "roles:create", role_id: ADMIN_ROLE[0]},
        {route: "roles:update", role_id: ADMIN_ROLE[0]},
        {route: "roles:delete", role_id: ADMIN_ROLE[0]},

        {route: "route-guards:browse", role_id: ADMIN_ROLE[0]},
        {route: "route-guards:view", role_id: ADMIN_ROLE[0]},
        {route: "route-guards:create", role_id: ADMIN_ROLE[0]},
        {route: "route-guards:delete", role_id: ADMIN_ROLE[0]},

        {route: "users:browse", role_id: ADMIN_ROLE[0]},
        {route: "users:view", role_id: ADMIN_ROLE[0]},
        {route: "users:create", role_id: ADMIN_ROLE[0]},
        {route: "users:update", role_id: ADMIN_ROLE[0]},
        {route: "users:delete", role_id: ADMIN_ROLE[0]},
    ]);
}
