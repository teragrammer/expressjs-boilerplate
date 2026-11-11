// database/seeds/users.ts
import type {Kysely} from "kysely";
import type {Database} from "../../src/config/schema";
import {securityUtil} from "../../src/config/container";
import {__ENV} from "../../src/config/environment";
import {logger} from "../../src/config/logger";
import {CANONICAL_ROUTES} from "../../src/modules/system/route-guards/route-guard.catalog";

/**
 * Development seed accounts.
 *
 * The seed is idempotent: roles are upserted by slug and users are
 * upserted by username, so running the seeder twice is safe.
 *
 * The password never defaults to a shared weak value. It comes from
 * `SEED_PASSWORD`; when that is unset a random password is generated
 * and logged once, so a deployment can never end up with a known
 * default credential.
 */
export async function seed(db: Kysely<Database>): Promise<void> {
    const roleDefinitions = [
        {
            name: "Administrator",
            slug: "admin",
            is_public: false,
            is_bypass_authorization: true,
        },
        {
            name: "Manager",
            slug: "manager",
            is_public: false,
            is_bypass_authorization: false,
        },
        {
            name: "Customer",
            slug: "customer",
            is_public: false,
            is_bypass_authorization: false,
        },
    ];

    const roles = new Map<string, number>();

    for (const role of roleDefinitions) {
        const row = await db
            .insertInto("roles")
            .values(role)
            .onConflict((oc) =>
                oc.column("slug").doUpdateSet((eb) => ({
                    name: eb.ref("excluded.name"),
                    is_public: eb.ref("excluded.is_public"),
                    is_bypass_authorization: eb.ref(
                        "excluded.is_bypass_authorization",
                    ),
                    updated_at: new Date(),
                })),
            )
            .returning("id")
            .executeTakeFirstOrThrow();

        roles.set(role.slug, row.id);
    }

    /*
     * Seed the canonical route permissions.
     *
     * The catalog lives in code so the seeded permissions and the
     * permissions the API enforces cannot drift apart.
     */
    for (const [slug, routes] of Object.entries(CANONICAL_ROUTES)) {
        const roleId = roles.get(slug);

        if (!roleId) {
            continue;
        }

        for (const route of routes) {
            await db
                .insertInto("route_guards")
                .values({role_id: roleId, route})
                .onConflict((oc) =>
                    oc.columns(["role_id", "route"]).doNothing(),
                )
                .execute();
        }
    }

    const configuredPassword = __ENV.SEED_PASSWORD;

    const password = configuredPassword
        ? configuredPassword
        : securityUtil.randomString(16);

    if (!configuredPassword) {
        logger.warn(
            "SEED_PASSWORD is not set; a random password was generated " +
            "for the seeded accounts: " + password,
        );
    }

    const hashedPassword = await securityUtil.hash(password);

    const accounts = [
        {username: "admin", role_slug: "admin"},
        {username: "manager", role_slug: "manager"},
        {username: "customer", role_slug: "customer"},
    ];

    for (const account of accounts) {
        const roleId = roles.get(account.role_slug);

        if (!roleId) {
            continue;
        }

        await db
            .insertInto("users")
            .values({
                username: account.username,
                password: hashedPassword,
                role_id: roleId,
            })
            .onConflict((oc) =>
                oc.column("username").doUpdateSet((eb) => ({
                    password: eb.ref("excluded.password"),
                    role_id: eb.ref("excluded.role_id"),
                    updated_at: new Date(),
                })),
            )
            .execute();
    }
}
