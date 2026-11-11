# ADR-010: Secret management and key rotation

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

Empty secrets were accepted at boot, so a misconfigured deployment
failed at the first request rather than at startup. There was no
rotation story for the signing or encryption keys.

## Decision

1. **Validated configuration.** The environment is parsed once at import
   time with a Joi schema. Secrets have a minimum length, integers have
   ranges, and production-only rules (explicit CORS allowlist, required
   secrets, TLS for non-loopback database and Redis endpoints) are
   enforced before the server starts.
2. **Fail closed.** A production process with missing or insecure
   configuration exits with a clear error rather than starting in a
   degraded mode.
3. **Secrets come from the platform.** Development uses `.env`;
   production injects the values from a secret manager or the
   orchestrator's secret store. No secret is committed, baked into an
   image or written to a log.
4. **Key rotation.** The cache envelope carries a version prefix
   (`v1:`), so a new key can be introduced with a dual read and a
   background re-encryption. The access token signing key is
   replaceable by deploying a new secret and letting the existing
   sessions expire.
5. **Rotation of the session material.** `authorization_version` is the
   existing invalidation mechanism for a change that must take effect
   immediately: incrementing it invalidates every issued token.

## Alternatives considered

- **Reading the secret file at boot without validation.** Rejected: the
  failure would surface at the first request.
- **Deriving every key from one master secret.** Rejected: it couples
  the rotation of unrelated keys. `JWT_SECRET`, `BCRYPT_SECRET` and
  `CRYPT0_SECRET` are separate.

## Consequences

- The `.env.example` file documents every variable, its type, its
  default and whether it is required in production.
- The production validation rules are enforced by
  `validateProductionConfig` and covered by tests.
- Rotating `JWT_SECRET` invalidates every active session; rotating
  `CRYPT0_SECRET` invalidates the cache (which rebuilds from the
  database).

## Related

- Section 6.8 of `docs/features.md` (configuration and transport
  security).
- F-09 and F-10 of `docs/features.md`.
