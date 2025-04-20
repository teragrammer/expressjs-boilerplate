import {Knex} from "knex";
import {SecurityUtil} from "../../src/utilities/security.util";

export async function seed(knex: Knex): Promise<void> {
    // Deletes ALL existing entries
    await knex("roles").del();
    await knex("users").del();

    // Insert roles
    const admin = await knex("roles").insert({name: 'Administrator', slug: 'admin', is_public: 0}).returning('id');
    const manager = await knex("roles").insert({name: 'Manager', slug: 'manager', is_public: 0}).returning('id');
    const customer = await knex("roles").insert({name: 'Customer', slug: 'customer', is_public: 0}).returning('id');

    // Inserts users
    const password = await SecurityUtil().hash("123456");
    await knex("users").insert([
        {username: "admin", password, role_id: admin[0]},
        {username: "manager", password, role_id: manager[0]},
        {username: "customer", password, role_id: customer[0]},
    ]);
}
