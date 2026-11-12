# Load and Performance Tests

Load tests use [Artillery](https://www.artillery.io/) to exercise the running API.
Configuration files are in `tests/load/`.

## Test files

| File | Purpose |
| --- | --- |
| `tests/load/run.sh` | Runner script: prerequisite checks, report generation |
| `tests/load/api.yml` | Default gradual ramp-up load test |
| `tests/load/smoke.yml` | Quick smoke test |
| `tests/load/stress.yml` | High-intensity stress test |
| `tests/load/soak.yml` | Long-duration soak test |
| `tests/load/data/users.csv` | Seeded test user credentials |
| `tests/load/plugins/hooks.js` | Custom Artillery request/response hooks |

## Test types

| Test | Duration | Arrival rate | Thresholds | Command |
| --- | --- | --- | --- | --- |
| Smoke | 10 s | 1/s | p95 ≤ 1000 ms, max ≤ 5000 ms, 2xx ≥ 90% | `npm run load:test:smoke` |
| Default | 4.5 min | 5 → 100/s | p95 ≤ 400 ms, p99 ≤ 1000 ms, 2xx ≥ 99% | `npm run load:test` |
| Stress | 4 min | 50 → 200/s | p95 ≤ 2000 ms, p99 ≤ 5000 ms, 2xx ≥ 95% | `npm run load:test:stress` |
| Soak | 45 min | 20 → 50/s | p95 ≤ 1000 ms, p99 ≤ 2000 ms, 2xx ≥ 95% | `npm run load:test:soak` |

The default profile runs warm-up (30 s at 5/s), ramp-up (60 s at 10/s), sustained
(120 s at 50/s), spike (30 s at 100/s), and cool-down (30 s at 50/s).

## Prerequisites

1. The API server is running:
   ```bash
   npm run dev
   # or
   npm run build && npm run start
   ```
2. The database is migrated and seeded:
   ```bash
   npm run db:migrate
   npm run db:seed
   ```
   The seeder creates `admin`, `manager`, and `customer` users. It uses
   `SEED_PASSWORD` when set; otherwise it generates a random password and logs it
   once.
3. Artillery is available. It is included as a dev dependency. `tests/load/run.sh`
   also checks for a global `artillery` command and installs one if it is missing.
4. `SEED_PASSWORD` is set. `run.sh` refuses to start without it. Set it to the same
   value used for `npm run db:seed` so the credentials in `tests/load/data/users.csv`
   match:
   ```bash
   export SEED_PASSWORD='<the seeded password>'
   ```
   `tests/load/data/users.csv` ships with the placeholder `pass1234`; update it when
   the seeded password differs.
5. The default target URL is `http://localhost:4000`, matching the default `PORT`.

## Commands

```bash
npm run load:test          # Default load test
npm run load:test:smoke    # Smoke test
npm run load:test:stress   # Stress test
npm run load:test:soak     # Soak test
```

Run a custom config:

```bash
bash tests/load/run.sh tests/load/custom.yml
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `TARGET_URL` | `http://localhost:4000` | Base URL of the API |
| `OUTPUT_DIR` | `tests/load/reports` | Directory for generated reports |
| `WORKERS` | auto | Number of Artillery workers |
| `SEED_USERNAME` | `admin` | Seeded account used by the runner checks |
| `SEED_PASSWORD` | required | Password of the seeded account |

Example:

```bash
TARGET_URL=https://api.example.com npm run load:test
```

## Covered endpoints

Public endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/password-recovery/send`

Protected endpoints:

- `POST /api/v1/auth/logout`
- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `GET /api/v1/settings`
- `GET /api/v1/settings/values`
- `GET /api/v1/roles`
- `GET /api/v1/roles/:id`
- `GET /api/v1/route/guards`
- `PUT /api/v1/account/information`

Load tests do not call the health probes; use `/health/live` and `/health/ready`
for deployment checks.

## Test data

`tests/load/data/users.csv` contains:

```csv
username,password,role
admin,pass1234,admin
manager,pass1234,manager
customer,pass1234,customer
```

Replace the placeholder password with the value passed to `SEED_PASSWORD` when seeding.

## Reports

Each run writes files to `OUTPUT_DIR`:

- `<config>_<timestamp>.json` — raw Artillery metrics
- `<config>_<timestamp>.log` — console output
- `<config>_<timestamp>.html` — generated HTML report

View reports:

```bash
ls tests/load/reports/
```

On Linux:

```bash
xdg-open tests/load/reports/api_*.html
```

## Interpreting results

Key metrics:

- `http.response_time.p95` and `http.response_time.p99` — latency percentiles
- `http.codes.2xx` — success rate
- `http.codes.4xx` / `http.codes.5xx` — client/server errors
- `vusers.failed` — failed virtual users
- `errors.*` — capture, expectation, or connection failures

If a threshold in `ensure.thresholds` is not met, Artillery exits with a non-zero
status and the npm script fails.

## Customization

Edit the YAML configs to change phases, scenarios, or thresholds. Edit
`tests/load/data/users.csv` to add users. Keep the password aligned with the seeded
accounts.

## Troubleshooting

- `SEED_PASSWORD is not set`: export it before running `run.sh`.
- `ECONNREFUSED`: ensure the server is running before starting the load test.
- Many `401` responses: verify the seeded users exist and that the CSV password matches
  the seeded password.
- High response times: check database connection pool settings, Redis availability,
  and application logs.
- Global Artillery install failure: install it manually with
  `npm install -g artillery` or run Artillery through `npx`.

## Notes

- `TARGET_URL` must be available to Artillery. `run.sh` exports it with the default
  value when it is not set.
- `DURATION` and `RATE` overrides are not implemented by `run.sh`; edit the YAML
  files to change phase durations or arrival rates.
- Load tests mutate seeded data, especially the account information and user
  creation scenarios. Reseed the database between runs when clean state is needed.
- Mail must be mocked; the recovery scenario would otherwise send real email.
- The rate limiter is active. Repeated logins from one address are expected to be
  throttled; `X-RateLimit-Limit` reports the budget.
