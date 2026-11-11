# Architecture Decision Records

These ADRs record the decisions that shape the platform. Each one
states the context, the decision, the alternatives that were considered
and the consequences.

| ADR | Title | Status | Review by |
| --- | --- | --- | --- |
| [0001](0001-modular-monolith.md) | Keep the modular monolith | Accepted | 2027-05-11 |
| [0002](0002-session-bound-tokens.md) | Session-bound access tokens with rotating refresh tokens | Accepted | 2027-05-11 |
| [0003](0003-authorization-model.md) | Authorization model — route guards, versioning and policy | Accepted | 2027-05-11 |
| [0004](0004-outbox-instead-of-broker.md) | PostgreSQL outbox instead of a message broker | Accepted | 2027-05-11 |
| [0005](0005-cache-crypto-and-invalidation.md) | Cache crypto, TTL and invalidation | Accepted | 2027-05-11 |
| [0006](0006-error-taxonomy.md) | Error taxonomy and API envelope | Accepted | 2027-05-11 |
| [0007](0007-observability.md) | Observability stack and retention | Accepted | 2027-05-11 |
| [0008](0008-data-retention-and-soft-delete.md) | Data retention, soft delete and audit requirements | Accepted | 2027-05-11 |
| [0009](0009-deployment-and-migrations.md) | Deployment topology and migration strategy | Accepted | 2027-05-11 |
| [0010](0010-secret-management.md) | Secret management and key rotation | Accepted | 2027-05-11 |

## Deferred decisions

The following are deliberately not decided yet. Each needs a funded
requirement and its own ADR.

- **TOTP, WebAuthn and enterprise SSO** (F-30). The email OTP remains
  the second factor. A phishing-resistant factor is a product
  requirement, not a default.
- **A normalized permissions table.** The route string catalog in
  `src/modules/system/route-guards/route-guard.catalog.ts` is
  manageable today.
- **A separate worker deployment.** The outbox worker runs safely in
  every replica; splitting it out is a deployment change.
- **Multi-tenancy.** There is no tenant requirement, so no tenant
  columns or scoping exist.
