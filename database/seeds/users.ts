import {Knex} from "knex";
import {SecurityUtil} from "../../src/utilities/security.util";

export async function seed(knex: Knex): Promise<void> {
    // Insert roles
    const [ADMIN_ROLE] = await knex("roles").insert({name: 'Administrator', slug: 'admin', is_public: 0, is_bypass_authorization: 1}).returning('id');
    const [MANAGER_ROLE] = await knex("roles").insert({name: 'Manager', slug: 'manager', is_public: 0}).returning('id');
    const [CUSTOMER_ROLE] = await knex("roles").insert({name: 'Customer', slug: 'customer', is_public: 0}).returning('id');

    // Inserts users
    const PASSWORD = await SecurityUtil().hash("123456");
    await knex("users").insert([
        {username: "admin", PASSWORD, role_id: ADMIN_ROLE},
        {username: "manager", PASSWORD, role_id: MANAGER_ROLE},
        {username: "customer", PASSWORD, role_id: CUSTOMER_ROLE},
    ]);
}
