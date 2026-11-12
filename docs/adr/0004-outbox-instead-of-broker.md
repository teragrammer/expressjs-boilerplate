# ADR-004: PostgreSQL outbox instead of a message broker

- **Status:** Accepted
- **Date:** 2026-11-11
- **Review by:** 2027-05-11

## Context

Email was sent inline, and inside a database transaction in the password
recovery flow. A slow or failing mail provider held a transaction and a
connection open, and there was no retry path, so a transient provider
error lost the message permanently.

## Decision

1. **A durable `outbox_events` table.** The row is written in the same
   transaction as the business change, so a rolled-back transaction never
   produces an email.
2. **An in-process worker.** `OutboxWorker` polls the table, claims a
   batch with `FOR UPDATE SKIP LOCKED` and dispatches to a registered
   handler. Several workers can poll the same table safely.
3. **Retries with exponential backoff.** A failed event is rescheduled
   with a bounded backoff and parked in the `failed` state after five
   attempts.
4. **A scheduled cleanup job.** Expired sessions, recovery codes, OTPs,
   refresh tokens, verification tokens, rate-limit rows and idempotency
   keys are removed in bounded batches.

## Alternatives considered

- **A message broker (Kafka, RabbitMQ).** Rejected: the outbox table
  covers the current volume, and a broker would add an operational
  dependency without a measured need.
- **Sending email inline.** Rejected: it couples request latency and
  database health to an external provider.
- **A separate worker process.** Deferred: the worker is safe to run in
  every worker today. A dedicated process is a deployment change, not a
  code change.

## Consequences

- Email delivery is asynchronous; the API returns before the message is
  sent.
- The queue depth is exposed as a metric and should be alerted on.
- Handlers must be idempotent, because an event may be delivered more
  than once.

## Related

- Section 10.4 of `docs/production-readiness-blueprint.md` (cross-cutting components).
- F-08 and F-20 of `docs/production-readiness-blueprint.md`.
