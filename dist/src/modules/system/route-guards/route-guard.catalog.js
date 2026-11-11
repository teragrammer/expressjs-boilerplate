"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROUTE_PATTERN = exports.ALL_CANONICAL_ROUTES = exports.CANONICAL_ROUTES = void 0;
exports.normalizeRoute = normalizeRoute;
// src/modules/system/route-guards/route-guard.catalog.ts
/**
 * Canonical route permission catalog.
 *
 * This is the single source of truth for which routes a role may
 * access. The seeder generates `route_guards` rows from it and the
 * route guards enforce the same strings, so the seeded permissions and
 * the enforced permissions cannot drift apart.
 *
 * A route string is `resource:action`, matching the strings passed to
 * `AuthorizationMiddleware`.
 */
exports.CANONICAL_ROUTES = {
    admin: [
        "users:create",
        "users:update",
        "users:browse",
        "users:view",
        "users:delete",
        "settings:create",
        "settings:update",
        "settings:browse",
        "settings:view",
        "settings:delete",
        "roles:create",
        "roles:update",
        "roles:browse",
        "roles:view",
        "roles:delete",
        "route-guards:create",
        "route-guards:browse",
        "route-guards:view",
        "route-guards:delete",
        "audit:view",
    ],
    manager: [
        "users:browse",
        "users:view",
        "users:update",
        "settings:browse",
        "roles:browse",
        "roles:view",
        "route-guards:browse",
        "route-guards:view",
    ],
    customer: [
        "users:view",
    ],
};
/**
 * Every route string known to the application.
 */
exports.ALL_CANONICAL_ROUTES = Array.from(new Set(Object.values(exports.CANONICAL_ROUTES).flat()));
/**
 * Route string format: `resource:action`.
 */
exports.ROUTE_PATTERN = /^[a-z0-9-]+:[a-z0-9-]+$/;
/**
 * Normalizes and validates a route string.
 *
 * @throws when the route does not follow the `resource:action` format.
 */
function normalizeRoute(route) {
    const normalized = route.trim().toLowerCase();
    if (!exports.ROUTE_PATTERN.test(normalized)) {
        throw new Error(`Invalid route guard '${route}': expected the format 'resource:action'.`);
    }
    return normalized;
}
