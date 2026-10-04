import {Knex} from "knex";
import {securityUtil} from "../../src/config/container";

export async function seed(knex: Knex): Promise<void> {
    // Insert roles
    const [ADMIN_ROLE] = await knex("roles").insert({
        name: 'Administrator',
        slug: 'admin',
        is_public: 0,
        is_bypass_authorization: 1
    }).returning('id');
    const [MANAGER_ROLE] = await knex("roles").insert({name: 'Manager', slug: 'manager', is_public: 0}).returning('id');
    const [CUSTOMER_ROLE] = await knex("roles").insert({
        name: 'Customer',
        slug: 'customer',
        is_public: 0
    }).returning('id');

    // Inserts users
    const password = await securityUtil.hash("pass1234");
    await knex("users").insert([
        {username: "admin", password: password, role_id: ADMIN_ROLE.id},
        {username: "manager", password: password, role_id: MANAGER_ROLE.id},
        {username: "customer", password: password, role_id: CUSTOMER_ROLE.id},
    ]);
}
