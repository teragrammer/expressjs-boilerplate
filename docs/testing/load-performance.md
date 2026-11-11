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
| Smoke | ~10s | 1/s | `http.response_time.p95` <= 1000ms | `npm run load:test:smoke` |
| Default | ~4.5 min | 5 to 100/s | p95 <= 500ms, p99 <= 1000ms, 2xx >= 95% | `npm run load:test` |
| Stress | ~4 min | 50 to 200/s | p95 <= 2000ms, p99 <= 5000ms | `npm run load:test:stress` |
| Soak | ~45 min | 20 to 50/s | p95 <= 1000ms, p99 <= 2000ms | `npm run load:test:soak` |

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
   Seeding creates `admin`, `manager`, and `customer` users with password `pass1234`.
3. Artillery is available. It is included as a dev dependency. `tests/load/run.sh`
   also checks for a global `artillery` command and installs one if it is missing.
4. The default target URL is `http://localhost:4000`, matching the default `PORT`.

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

Example:

```bash
TARGET_URL=https://api.example.com npm run load:test
```

## Covered endpoints

Public endpoints:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/password-recovery/send`

Protected endpoints:

- `GET /api/v1/auth/logout`
- `GET /api/v1/users`
- `GET /api/v1/users/:id`
- `GET /api/v1/settings`
- `GET /api/v1/settings/values`
- `GET /api/v1/roles`
- `GET /api/v1/roles/:id`
- `GET /api/v1/route/guards`
- `PUT /api/v1/account/information`
- `PUT /api/v1/account/password`

The API does not expose a `/health` endpoint, so load tests do not call one.

## Test data

`tests/load/data/users.csv` contains:

```csv
username,password,role
admin,pass1234,admin
manager,pass1234,manager
customer,pass1234,customer
```

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
`tests/load/data/users.csv` to add users. The default password for seeded users is
`pass1234`.

## Troubleshooting

- `ECONNREFUSED`: ensure the server is running before starting the load test.
- Many `401` responses: verify seeded users exist and credentials match
  `tests/load/data/users.csv`.
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
