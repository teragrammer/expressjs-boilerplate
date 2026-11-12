# ADR-005: Cache crypto, TTL and invalidation

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

The Redis cache encrypted payloads with AES-256-GCM and additionally
bcrypt-hashed them for "integrity". Every cache read and write therefore
cost hundreds of milliseconds, which made the cache slower than the
database it was meant to shield. The in-process (L1) cache never
expired, and subscriptions were attached only at boot, so a Redis
restart silently disabled invalidation for the lifetime of the process.

## Decision

1. **AES-256-GCM only.** A 32-byte key is derived from `CRYPT0_SECRET`
   with HKDF-SHA-256 and a purpose-bound context. The envelope is
   `v1:iv:tag:ciphertext`. GCM already provides integrity, so no
   password hashing is performed on the cache path.
2. **A TTL on the L1 cache.** Local entries expire after one hour and
   fall through to L2 and then the database.
3. **Re-subscription on reconnect.** The subscriber tracks its channels
   and re-issues the subscription when Redis becomes ready again.
4. **Failures are observable and non-fatal.** A cache error is logged,
   counted and falls back to the database. A malformed payload is
   treated as a miss.
5. **Only settings and route guards are cached.** They are small,
   shared and change rarely.

## Alternatives considered

- **Plain JSON in Redis.** Rejected: the payload contains configuration
  that should not be readable by anyone with access to the Redis
  instance.
- **Keeping bcrypt for integrity.** Rejected: it provided no additional
  guarantee over GCM's authentication tag and made the cache unusable.
- **A distributed cache library.** Rejected: the requirement is a
  key/value cache with pub/sub invalidation, which the current stack
  already provides.

## Consequences

- Cache operations are microseconds rather than hundreds of
  milliseconds.
- The key version prefix allows a key rotation with dual reads.
- The cache never holds per-user data or secrets.

## Related

- Section 7.4 of `docs/production-readiness-blueprint.md` (performance findings).
- F-16 of `docs/production-readiness-blueprint.md`.
