# ADR-001: Keep the modular monolith

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

The repository is a single deployable Express service with clear module
boundaries (`auth`, `users`, `system`) and manual dependency injection in
`src/config/container.ts`. The blueprint considered splitting the system
into services.

## Decision

Keep the modular monolith. Do not introduce microservices, a separate
authentication service, an ORM or a DI framework.

## Alternatives considered

- **Microservices.** Rejected: the current scale and team shape do not
  justify the operational cost, the network failure modes or the
  distributed transactions that registration and password reset need.
- **A DI framework.** Rejected: the manual container is small and
  explicit. The duplication it caused is fixed by routing every module
  through the container.
- **An ORM.** Rejected: Kysely already gives typed SQL, transactions and
  explicit query plans without hiding them.

## Consequences

- Cross-module calls go through service interfaces, not another
  module's repository.
- The container is the single composition root; routes must not
  instantiate services.
- Scaling beyond one deployable requires revisiting this decision.

## Related

- Section 10.3 of `docs/production-readiness-blueprint.md` (module boundaries).
- ADR-003 (authorization model).
