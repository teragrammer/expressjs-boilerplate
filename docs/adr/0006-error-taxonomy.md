# ADR-006: Error taxonomy and API envelope

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

Database errors reached the client as generic 500 responses, so a
duplicate email, a foreign-key violation and a real server fault were
indistinguishable. Clients could not recover from a conflict, and the
responses leaked no structure to build on.

## Decision

1. **One error envelope.** Every error is
   `{code, message, errors?}` with a stable machine-readable `code`.
   Validation failures add an `errors` array of `{field, message}`.
2. **PostgreSQL errors are mapped centrally.**
   `src/common/utils/db-error.mapper.ts` translates the SQLSTATE codes
   into stable API errors:
   - `23505` unique violation → 409
   - `23503` foreign-key violation → 409
   - `23502` / `23514` not-null and check violations → 422
   - `40001` / `40P01` serialization and deadlock → 500 with a retry
     hint
   - connection failures → 503
3. **Nothing internal leaks.** Table names, column names, constraint
   names and SQL text never reach the client; they are logged.
4. **Generic authentication failures.** Login, registration and
   recovery return the same message and status whether or not the
   account exists.
5. **Validation errors are 422, malformed requests are 400, rate limits
   are 429 with `Retry-After`, and unavailable dependencies are 503.**

## Alternatives considered

- **Returning the raw driver error.** Rejected: it leaks schema
  details and forces clients to parse driver-specific messages.
- **A single 500 for everything.** Rejected: it is the status quo the
  blueprint identified as a defect.

## Consequences

- The `code` values are part of the public contract and must stay
  stable.
- New error codes are added to `src/common/utils/messages.ts`.
- The OpenAPI contract documents the shared responses.

## Related

- Section 6.7 of `docs/features.md` (error handling).
- F-15 of `docs/features.md`.
