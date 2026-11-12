# Documentation

Technical documentation for the Express.js 5 + TypeScript + PostgreSQL API boilerplate.

## Start here

| Document | Purpose |
| --- | --- |
| [Production readiness and feature blueprint](production-readiness-blueprint.md) | Architecture, security, performance, database, testing, feature specifications (F-01–F-30), implementation status, roadmap, and production-readiness checklist. |
| [OpenAPI contract](openapi.yaml) | Machine-readable API contract (OpenAPI 3.1). Validate with `npm run openapi:lint`. |

## Architecture decisions

Architecture Decision Records capture the context, decision, alternatives, and consequences for the platform's core design choices. Ten ADRs cover the modular monolith, session-bound tokens, authorization, the outbox, cache crypto, error taxonomy, observability, data retention, deployment/migrations, and secret management.

See the [ADR index](adr/README.md) for the full table and deferred decisions.

## Runbooks

Operational procedures for running and recovering the service.

| Runbook | Use |
| --- | --- |
| [Deployment and rollback](runbooks/deployment.md) | Release a change, roll out a canary, and roll back safely. |
| [Migrations](runbooks/migrations.md) | Apply and reverse schema changes in a running deployment. |
| [Backup and restore](runbooks/backup-and-restore.md) | Backup requirements, restore drills, and recovery scenarios. |
| [Incident response](runbooks/incident-response.md) | First response, common failure scenarios, escalation, and post-incident actions. |

## Testing

| Guide | Use |
| --- | --- |
| [Integration tests](testing/integration.md) | Run the HTTP integration, regression, session, and cleanup suites against PostgreSQL. |
| [Load and performance tests](testing/load-performance.md) | Run Artillery smoke, default, stress, and soak profiles; interpret thresholds and reports. |

## Conventions

- All prose documentation is Markdown (`.md`); the API contract is `openapi.yaml`.
- Filenames are lowercase kebab-case.
- ADRs use `NNNN-short-title.md` and are registered in [`adr/README.md`](adr/README.md).
- Status labels: **Existing**, **Incomplete**, **Missing**, **Recommended**, **P0**–**P3**.
- Source paths in documentation are relative to the repository root.

## Related project files

The following are outside this directory but are referenced by the documentation:

- `README.md` — project setup and overview
- `AGENTS.md` — repository commands, testing rules, and architecture notes
- `.env.example` — configuration surface
- `src/config/migrator.ts` — static migration registry
- `scripts/db/` — migration and seed runners
