# ADR-007: Observability stack and retention

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

The service logged a single line per request containing only the method
and the URL, in a pretty format, in every environment. There was no
request id, no status, no latency and no way to correlate a request
with a failure. There were no metrics and no audit trail.

## Decision

1. **Structured logs with a correlation id.** `AsyncLocalStorage` carries
   a request context (`X-Request-ID`, method, route, user id, IP) that
   is attached to every log line, the audit event and the metric. The
   request id is validated when supplied by the client and generated
   otherwise.
2. **JSON in production, pretty in development.** Pino emits JSON in
   production so a log shipper can parse it.
3. **Redaction.** Authorization headers, cookies, passwords, codes,
   tokens and secrets are redacted before serialization.
4. **Prometheus metrics.** HTTP request count and latency by route
   template and status, authentication outcomes, rate-limit rejections,
   cache operations, database pool state, outbox queue depth and audit
   events. Labels are bounded: route templates and statuses only.
5. **Health and readiness probes.** `/health/live` checks only that the
   event loop is responsive; `/health/ready` checks PostgreSQL (and
   Redis when configured) with a short, cached result.
6. **An append-only audit trail.** `audit_logs` records authentication
   and administrative events with the actor, action, target, outcome,
   request id, IP and redacted metadata. A database trigger rejects
   updates to the table.
7. **Retention.** Audit rows are removed by the cleanup job after the
   configured retention window; the runtime role must not hold `DELETE`
   on the table in production.

## Alternatives considered

- **OpenTelemetry tracing from day one.** Deferred: request-id
  correlation answers the immediate need. Tracing can be added when the
  platform has a collector.
- **Logging request bodies.** Rejected: they carry credentials and PII.
- **High-cardinality metric labels.** Rejected: user ids, emails and
  raw URLs would explode the metric series count and leak identifiers.

## Consequences

- The metrics endpoint is unauthenticated and must be restricted at the
  network layer.
- Log volume and the metrics series count should be reviewed during
  load testing.
- Retention windows are platform decisions and must be configured
  together with the alerting rules.

## Related

- Section 6.10 of `docs/features.md` (logging, monitoring and audit).
- Section 7.6 of `docs/features.md` (performance budgets).
- F-17, F-18 and F-19 of `docs/features.md`.
