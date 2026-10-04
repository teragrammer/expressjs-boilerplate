import type {Kysely} from "kysely";
import type {Database} from "../../src/config/schema";
import {securityUtil} from "../../src/config/container";

export async function seed(db: Kysely<Database>): Promise<void> {
    const adminRole = await db
        .insertInto("roles")
        .values({
            name: 'Administrator',
            slug: 'admin',
            is_public: false,
            is_bypass_authorization: true,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

    const managerRole = await db
        .insertInto("roles")
        .values({name: 'Manager', slug: 'manager', is_public: false})
        .returning("id")
        .executeTakeFirstOrThrow();

    const customerRole = await db
        .insertInto("roles")
        .values({name: 'Customer', slug: 'customer', is_public: false})
        .returning("id")
        .executeTakeFirstOrThrow();

    const password = await securityUtil.hash("pass1234");

    await db
        .insertInto("users")
        .values([
            {username: "admin", password: password, role_id: adminRole.id},
            {username: "manager", password: password, role_id: managerRole.id},
            {username: "customer", password: password, role_id: customerRole.id},
        ])
        .execute();
}
