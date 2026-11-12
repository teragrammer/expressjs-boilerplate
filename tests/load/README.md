# Load and performance testing

The Artillery configurations in this directory implement the load-test
program from the blueprint (Section 7.7). Each profile has a threshold
that fails the run when a budget is exceeded.

## Prerequisites

1. A running instance with a realistic dataset.
2. The seed credentials. The seeder never uses a shared weak password:
   it either takes `SEED_PASSWORD` from the environment or generates a
   random one and logs it once.

```bash
export SEED_USERNAME=admin
export SEED_PASSWORD='<the seeded password>'
export TARGET_URL=http://localhost:4000
```

`run.sh` also reads the project `.env`, so `SEED_PASSWORD` can be defined
there instead. Values exported in the shell take precedence over `.env`.

## Profiles

| Command | Profile | Duration | Load | Purpose |
| --- | --- | --- | --- | --- |
| `npm run load:test:smoke` | smoke | 10 s | 1 req/s | CI gate. Verifies the wiring and the login budget. |
| `npm run load:test` | default | 4.5 min | 5 → 100 req/s | The baseline: warm-up, ramp, sustained load, spike, cool-down. |
| `npm run load:test:stress` | stress | 5 min | up to 300 req/s | Finds the saturation point and the failure mode. |
| `npm run load:test:soak` | soak | 30 min | 20 req/s | Detects memory, connection and table growth. |

A custom configuration can be passed by name:

```bash
bash tests/load/run.sh my-profile.yml
```

## Budgets

The thresholds come from the blueprint (Section 7.6).

| Metric | Budget | Enforced by |
| --- | --- | --- |
| Login p95 | < 400 ms | `api.yml` |
| Login p99 | < 1000 ms | `api.yml` |
| Authenticated read p95 | < 150 ms | `api.yml` |
| Browse p95 | < 250 ms | `api.yml` |
| Write p95 | < 300 ms | `api.yml` |
| 5xx rate | < 1 % | every profile |
| DB pool wait p95 | < 10 ms | the pool metric in `/metrics` |
| Slow queries | log queries > 100 ms | `log_min_duration_statement` |

## Scenarios

- Login and logout.
- Authenticated user browse and read.
- Settings browse and the public settings values.
- Role browse and read.
- Route guard browse.
- Account profile update.
- Password recovery send (mocked email).

## Reports

The reports are written to `tests/load/reports/` as JSON, HTML and a
log. The directory is git-ignored, so the results are not committed.

## Cadence

| Trigger | Profile |
| --- | --- |
| Pull request | smoke |
| Main merge | smoke |
| Nightly | default |
| Weekly | stress |
| Monthly | soak and a restore drill |

## Comparing a run against the baseline

```bash
bash tests/load/run.sh
artillery report tests/load/reports/api_<timestamp>.json
```

Compare the p95/p99 and the error rate with the recorded baseline
before and after a change that touches authentication, the database or
the cache. The comparison is only meaningful on the same hardware and
the same dataset size.

## Notes

- The mail provider must be mocked: the password-recovery scenario
  would otherwise send real email.
- The rate limiter is active. A scenario that logs in repeatedly from
  the same address will be throttled; that is expected behaviour, and
  the `X-RateLimit-Limit` header reports the budget.
- The load generator must not be the bottleneck. Use `WORKERS` to
  spread the load and watch the generator's own CPU usage.
