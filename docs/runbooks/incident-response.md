# Runbook: Incident response

## Scope

What to do when the service misbehaves in production.

## First five minutes

1. **Check the health endpoints.**

   ```bash
   curl -s https://<host>/health/live
   curl -s https://<host>/health/ready
   ```

   `/health/live` failing means the process is down or the event loop is
   blocked. `/health/ready` failing with `database: down` means
   PostgreSQL is unreachable; with `redis: down` it means the cache is
   unavailable (the service degrades to database-only mode).

2. **Look at the metrics.**

   ```bash
   curl -s https://<host>/metrics | grep -E 'app_(http_requests_total|auth_attempts_total|rate_limit_rejections_total|outbox_queue_depth|db_pool_connections)'
   ```

   The signals that matter first: the 5xx rate, the p95 latency, the
   authentication failure rate, the rate-limit rejections and the
   database pool size.

3. **Find the request.** Every response carries `X-Request-ID`. Search
   the logs for it; the same id appears on the log line, on the audit
   event and in the rate-limit record.

4. **Check the database.**

   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   SELECT * FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
   ```

   A saturated pool (`app_db_pool_connections`) usually means long
   transactions or a slow query, not a connection leak.

5. **Check the outbox.** `app_outbox_queue_depth` rising means the
   worker is not draining the queue: either the worker is down, the
   mail provider is failing, or the events are failing repeatedly
   (`outbox_events.status = 'failed'`).

## Common scenarios

### Elevated 5xx rate

1. Correlate with the error rate per route in the metrics.
2. Check whether the failures are database constraint errors (409
   mapped errors) or genuine server errors.
3. If the failures are genuine server errors, look for the request id
   in the logs; the error middleware logs the serialised error.

### Authentication failures spike

1. Check `app_auth_attempts_total{outcome="failure"}`.
2. A spike with a flat success rate is probably credential stuffing.
   The rate limiter should already be rejecting it
   (`app_rate_limit_rejections_total`).
3. Review the audit trail for `auth.login.failed` events and their
   source IPs.

### The service is slow

1. Compare `app_http_request_duration_seconds` with the budgets in
   `docs/features.md` (Section 7.6).
2. Login is bcrypt-dominated: 200–400 ms per attempt at cost 12.
   A rise in login latency usually means the CPU is saturated by
   bcrypt, not that the database is slow.
3. Check the cache hit ratio in the logs (`app_cache_operations_total`).
   A drop in hits means the cache is being missed and every request
   falls through to the database.

### Redis is unavailable

The service runs in database-only mode: the cache reads fall back to
the database and the rate limiter keeps working against its own table.
The readiness endpoint reports `redis: down` and returns 503, so an
orchestrator can take the instance out of rotation. Restore Redis and
the subscriptions are re-attached automatically when the client becomes
ready again.

### The outbox is not draining

1. `SELECT type, status, count(*) FROM outbox_events GROUP BY 1, 2;`
2. A large `failed` count means the handler is erroring. Read
   `last_error`.
3. Requeue after fixing the cause:
   `UPDATE outbox_events SET status = 'pending', available_at = now() WHERE status = 'failed';`

### A user cannot log in

1. Check the account status: a `Suspended`, `Deactivated` or
   `Pending` account is refused with a generic message by design.
2. Check the lockout: `login_tries` and `failed_login_expired_at` on
   the user row.
3. Check whether TFA is required: the `tta_policy` setting and the
   user's `has_tfa` flag. A restricted token cannot call the account
   endpoints until the OTP is verified.

### A user was deleted by mistake

Deleting a user is a soft delete: the row keeps `deleted_at` and the
session rows are revoked. To restore, clear `deleted_at` and re-check
the user's status and role. The audit trail records who performed the
deletion.

## Escalation

- **P0** (data loss, authentication bypass, full outage): page the
  on-call engineer immediately and open an incident.
- **P1** (degraded performance, partial outage): page during business
  hours, open an incident.
- **P2** (single-endpoint failure, elevated error rate on one route):
  open a ticket and schedule a fix.

## After the incident

1. Write the timeline from the logs, using the request ids.
2. Record the audit events that are relevant.
3. Write the follow-up actions with an owner and a date.
4. If a defensive control was missing, add the regression test before
   the fix.
