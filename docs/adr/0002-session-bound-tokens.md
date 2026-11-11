# ADR-002: Session-bound access tokens with rotating refresh tokens

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

The service previously issued a single JWT that lived for seven days
(sixty in the example configuration) and was not tied to a revocable
session. Account updates minted a second token shape (`tid: 0`) that
skipped the session lookup entirely, which bypassed revocation and
broke authorization.

## Decision

1. **One token contract.** Every access token is issued by
   `SessionService` and always references a live `authentication_tokens`
   row (`tid`). The `tid: 0` bypass is removed; the middleware rejects a
   token without a positive `tid`.
2. **Short-lived access tokens.** The access token lives for
   `JWT_ACCESS_TOKEN_MINUTES` (15 minutes by default) and carries
   `uid`, `tid`, `tfa`, `rol`, `bpa`, `av`, `iss`, `aud` and `jti`.
3. **Rotating refresh tokens.** The refresh token is 256 bits of
   randomness delivered in an `HttpOnly; Secure; SameSite=Strict`
   cookie scoped to `/api/v1/auth`. Only its SHA-256 hash is stored.
   Every use rotates the token inside the same family.
4. **Reuse detection.** Presenting an already-used refresh token revokes
   the entire family and is recorded as an audit event.
5. **The session row is the revocation authority.** Session expiry, user
   status and the user's `authorization_version` are checked on every
   authenticated request.

## Alternatives considered

- **Stateless long-lived tokens.** Rejected: revocation would only take
  effect at expiry, which is the vulnerability the blueprint identified.
- **Refresh tokens in the response body.** Rejected: they would be
  readable by scripts and stored in client-side storage. A body field
  remains possible for non-browser clients, but the cookie is the
  default and the safer path.

## Consequences

- Clients must store the access token in memory and use the cookie for
  refresh.
- The refresh flow needs CSRF protection if cookies are used; the
  `SameSite=Strict` attribute and the scoped path provide the first
  layer, and an origin check belongs in front of the endpoint.
- A lost refresh token ends the session; the client logs in again.

## Related

- Section 6.6 of `docs/features.md` (token and session deep dive).
- F-03, F-04 and F-11 of `docs/features.md`.
