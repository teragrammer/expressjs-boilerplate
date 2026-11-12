# ADR-009: Deployment topology and migration strategy

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

The service was a single development container running as root with
the whole repository mounted, and migrations ran implicitly from the
application in every replica. A rolling deploy would race several
replicas against the same schema change.

## Decision

1. **One API image, stateless replicas.** The API is stateless: sessions
   live in PostgreSQL, the cache and the rate limits live in Redis.
   Replicas scale horizontally behind a load balancer.
2. **A multi-stage, non-root image.** The builder installs the full
   dependency tree and compiles the TypeScript; the runtime stage
   carries only the compiled output and the production dependencies,
   runs as the unprivileged `node` user, has no shell tooling and uses
   `tini` as the entrypoint so signals reach the application.
3. **Migrations run once, before the traffic.** The migration job is a
   separate deployment step, not part of the application boot. The
   static migration registry keeps the schema change an explicit,
   reviewable diff.
4. **A documented connection budget.** `DB_POOL_MAX` multiplied by the
   worker count must stay below `DB_MAX_CONNECTIONS_TOTAL`; the
   application warns at boot when it does not. The formula is
   `pool_max_per_worker = floor((max_connections - reserve) / workers)`.
5. **Graceful shutdown.** Workers stop accepting connections, drain
   in-flight requests with a timeout and close the database pool and the
   Redis clients. The cluster primary forwards the signal to every
   worker and waits for them to exit.
6. **Probes.** `/health/live` and `/health/ready` are wired to the
   container health check and to the orchestrator's startup, liveness and
   readiness probes.
7. **PgBouncer is evaluated, not assumed.** It is introduced when the
   connection count or churn becomes the bottleneck, not by default.

## Alternatives considered

- **A separate worker image.** Deferred: the outbox worker runs safely
  in every replica today. Splitting the image is a deployment change.
- **Automatic migrations on boot.** Rejected: several replicas would race
  against the same schema change.
- **A distroless image.** Deferred: `node:24-bookworm-slim` plus
  `tini` is a reasonable base for now; the difference is a size
  optimisation.

## Consequences

- The deployment needs a migration step and a rollback plan.
- Connection budgets must be reviewed when the replica or worker count
  changes.
- The image is reproducible from the lockfile and is scanned in CI.

## Related

- Section 10.9 of `docs/production-readiness-blueprint.md` (deployment topology).
- F-21, F-22 and F-23 of `docs/production-readiness-blueprint.md`.
