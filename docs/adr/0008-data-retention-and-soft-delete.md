# ADR-008: Data retention, soft delete and audit requirements

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

Deleting a role cascaded to every user assigned to it, and deleting a
user was a hard delete that destroyed the account history. Both are
routine administrative actions with catastrophic side effects.

## Decision

1. **Restrictive foreign keys.** `users.role_id`,
   `authentication_tokens.user_id`, `two_factor_authentications.token_id`
   and `route_guards.role_id` use `ON DELETE RESTRICT`. A referenced row
   cannot be removed by accident.
2. **Soft delete for users.** `UserController.delete` sets `deleted_at`.
   Every read path filters `deleted_at IS NULL`, so a deleted account
   cannot authenticate and cannot be browsed.
3. **Explicit conflicts.** Deleting a role that is still assigned to
   users or route guards returns 409 with a message that names the
   problem. Route guards are unique per `(role_id, route)`.
4. **Hard delete is reserved.** A permanent removal is a separate,
   explicitly authorized operation with a reason and an audit event. It
   is not exposed by the standard delete endpoint.
5. **Sessions are revoked with the account.** Deleting a user revokes
   its sessions in the same operation.
6. **The audit trail is the retention record.** Because the audit table
   is append-only and holds the actor and the target, the removal of a
   user leaves a record of who did it.

## Alternatives considered

- **Keeping `ON DELETE CASCADE`.** Rejected: it allowed a routine action
  to destroy accounts.
- **Purging deleted users immediately.** Rejected: it destroys the
  history the audit trail refers to. The retention window is a platform
  and legal decision.

## Consequences

- Reads must keep filtering `deleted_at`; the browse indexes include it
  so the predicate stays index-backed.
- Anonymisation of a deleted user's personal data is a product and
  legal decision and is not yet implemented; the soft-deleted row still
  holds the values.
- The hard-delete operation must be implemented and authorized before a
  right-to-erasure request can be fulfilled automatically.

## Related

- Section 5.1 of `docs/production-readiness-blueprint.md` (TD-9, destructive defaults).
- F-05 and F-19 of `docs/production-readiness-blueprint.md`.
