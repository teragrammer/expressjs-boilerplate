# Integration Tests

Integration tests exercise the Express application through HTTP requests using
`supertest`. They run against a real PostgreSQL database and use the same Kysely
migrations as the application.

## Test files

| File | Purpose |
| --- | --- |
| `tests/integration/account.spec.ts` | Account profile and password updates; TFA and authentication requirements |
| `tests/integration/cleanup.spec.ts` | Cleanup job deletes expired sessions, recovery rows, OTPs, refresh tokens, verifications, rate limits, and idempotency keys |
| `tests/integration/login.spec.ts` | Login with valid credentials |
| `tests/integration/password-recovery.spec.ts` | Recovery send/validate flows; non-enumeration; SendGrid is mocked |
| `tests/integration/register.spec.ts` | Registration success and validation failures |
| `tests/integration/regression.spec.ts` | P0 regression suite (F-01 onward): validation, user CRUD, tokens, sessions, deletion, rate limits, recovery, TFA, errors |
| `tests/integration/session.spec.ts` | Session and token lifecycle; refresh rotation/reuse; audit events |
| `tests/integration/tfa.spec.ts` | TFA lifecycle: restricted tokens, OTP upgrade, lockout, enrollment, recovery codes |
| `tests/integration/two-factor-authentication.spec.ts` | OTP send/validate and authentication requirements |
| `tests/integration/helpers.ts` | Shared setup helpers |

## How the tests run

- Vitest configuration: `vitest.config.ts`.
- Included files: `src/**/*.spec.ts` and `tests/integration/**/*.spec.ts`.
- Global setup: `tests/integration/setup.ts` runs `migrateToLatest()` before all test
  files and closes the database connection afterward.
- The rate limiter is disabled for the suite by default; the regression suite enables it
  explicitly to verify enforcement.
- Tests import the Express app directly (`src/app.ts`), so no server process needs to
  be running.

## Prerequisites

1. PostgreSQL is reachable using the `DB_*` values in `.env`.
2. `.env` is configured. At minimum, set:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
   - `JWT_SECRET`
   - `BCRYPT_SALT_ROUND`, `BCRYPT_SECRET`
   - `CRYPT0_SECRET` / `CRYPT0_CIPHER` as required by the app
3. Database roles exist. The integration tests query the `customer` role, so seed the
   database first:
   ```bash
   npm run db:seed
   ```
   The seeder creates the `admin`, `manager`, and `customer` users and the canonical
   route guards. It uses `SEED_PASSWORD` when set; otherwise it generates a random
   password and logs it once.
4. Redis is optional. If `REDIS_HOST` is not set, the app runs in database-only
   fallback mode.

SendGrid is mocked in `password-recovery.spec.ts`, `tfa.spec.ts`, and
`two-factor-authentication.spec.ts`, so `SENDGRID_API_KEY` is not required for tests.

## Commands

Run all tests (unit and integration):

```bash
npm test
npm run test:run
```

Run only integration tests:

```bash
npx vitest run tests/integration --no-file-parallelism
```

Run a single integration test file:

```bash
npx vitest run tests/integration/account.spec.ts --no-file-parallelism
npx vitest run tests/integration/login.spec.ts --no-file-parallelism
npx vitest run tests/integration/register.spec.ts --no-file-parallelism
npx vitest run tests/integration/password-recovery.spec.ts --no-file-parallelism
npx vitest run tests/integration/regression.spec.ts --no-file-parallelism
npx vitest run tests/integration/session.spec.ts --no-file-parallelism
npx vitest run tests/integration/tfa.spec.ts --no-file-parallelism
npx vitest run tests/integration/two-factor-authentication.spec.ts --no-file-parallelism
npx vitest run tests/integration/cleanup.spec.ts --no-file-parallelism
```

Always use `--no-file-parallelism` because all tests share one database.

## Environment variables

The tests use the same database configuration as the application:

| Variable | Required | Notes |
| --- | --- | --- |
| `DB_HOST` | Yes | PostgreSQL host |
| `DB_PORT` | Yes | PostgreSQL port (default `5432`) |
| `DB_USER` | Yes | PostgreSQL user |
| `DB_PASS` | Yes | PostgreSQL password |
| `DB_NAME` | Yes | PostgreSQL database name |
| `JWT_SECRET` | Yes | JWT signing secret |
| `REDIS_HOST` | No | Enables Redis cache/pub-sub when set |

## Expected output

A successful full run ends with a Vitest summary similar to:

```text
Test Files  55 passed (55)
Tests       697 passed (697)
```

The count grows as tests are added; use it as a smoke signal, not a fixed contract.

## Notes

- Some specs create users and do not remove every row. Repeated runs can accumulate
  test users, but roles and settings are provided by migrations/seeds.
- The `customer` role must exist before running the tests.
- Integration tests do not require a running HTTP server.
- See [load-performance.md](load-performance.md) for the Artillery load suite.
