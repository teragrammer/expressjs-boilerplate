# ADR-003: Authorization model — route guards, versioning and policy

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

Authorization was based on the role slug and bypass flag embedded in the
JWT, checked against a cached map of route strings. A demoted or
suspended administrator kept access until the token expired, and the
route-guard table had no unique constraint, no index on `role_id` and no
seed data, so non-admin roles had no permissions by default.

## Decision

1. **Route guards stay the coarse-grained mechanism.** A route string has
   the format `resource:action` and is enforced by
   `AuthorizationMiddleware`. The canonical catalog lives in
   `src/modules/system/route-guards/route-guard.catalog.ts` and seeds
   the `route_guards` table, so the enforced and the seeded permissions
   cannot drift apart.
2. **Unique `(role_id, route)` and an index on `role_id`.** Duplicate
   grants are rejected with a 409.
3. **Authorization version.** `users.authorization_version` is
   incremented on a role or status change and is embedded in the access
   token. The authentication path compares the two, so a permission
   change takes effect on the next request instead of at token expiry.
4. **Field-level policy in the service layer.** `src/common/authz/policy.ts`
   decides whether an actor may change privileged fields (`role_id`,
   `status`, another user's password). The check lives in the service so
   every entry point is covered, not only the route.
5. **Deny by default.** A missing role, an unknown route guard or a
   missing cache entry denies the request.

## Alternatives considered

- **A normalized `permissions` table.** Deferred: the route string
  catalog is small and reviewable today. Revisit only if it becomes
  unmanageable.
- **Reading the role from the database on every request.** Rejected: it
  adds a query to the hot path. The version check uses the user row
  that is already loaded for the status check.
- **Keeping the claims as the only source of truth.** Rejected: it delays
  permission changes until the token expires.

## Consequences

- `is_bypass_authorization` grants every permission and must be
  restricted to a super-admin role and audited.
- The catalog and the database must be re-seeded after a route change.
- Authorization denials should be logged with the actor, route and
  request id.

## Related

- Section 6.5 of `docs/features.md` (authorization deep dive).
- F-13 and F-27 of `docs/features.md`.
