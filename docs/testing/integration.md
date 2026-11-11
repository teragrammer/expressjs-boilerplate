# Integration Tests

Integration tests exercise the Express application through HTTP requests using
`supertest`. They run against a real PostgreSQL database and use the same Kysely
migrations as the application.

## Test files

| File | Purpose |
| --- | --- |
| `tests/integration/account.spec.ts` | Authenticated account information and password changes |
| `tests/integration/login.spec.ts` | Login with valid credentials |
| `tests/integration/register.spec.ts` | Registration success and validation failures |
| `tests/integration/password-recovery.spec.ts` | Password recovery send/validate flows (SendGrid is mocked) |
| `tests/integration/two-factor-authentication.spec.ts` | TFA OTP send/validate and authentication requirements |

## How the tests run

- Vitest configuration: `vitest.config.ts`
- Included files: `src/**/*.spec.ts` and `tests/integration/**/*.spec.ts`
- Global setup: `tests/integration/setup.ts` runs `migrateToLatest()` before all test
  files and closes the database connection afterward.
- Tests import the Express app directly (`src/app.ts`), so no server process needs to
  be running.

## Prerequisites

1. PostgreSQL is reachable using the `DB_*` values in `.env`.
2. `.env` is configured. At minimum, set:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
   - `JWT_SECRET`
   - `BCRYPT_SALT_ROUND`, `BCRYPT_SECRET`
   - `CRYPT0_SECRET` / `CRYPT0_CIPHER` / `CRYPTO_IV` as required by the app
3. Database roles exist. The integration tests query the `customer` role, so seed the
   database first:
   ```bash
   npm run db:seed
   ```
   `npm run db:seed` also creates the `admin`, `manager`, and `customer` users with
   password `pass1234`.
4. Redis is optional. If `REDIS_HOST` is not set, the app runs in database-only
   fallback mode.

SendGrid is mocked in `password-recovery.spec.ts` and `two-factor-authentication.spec.ts`,
so `SENDGRID_API_KEY` is not required for tests.

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
npx vitest run tests/integration/two-factor-authentication.spec.ts --no-file-parallelism
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

A successful run ends with a Vitest summary similar to:

```text
Test Files  5 passed (5)
Tests       26 passed (26)
```

Migration messages from `migrateToLatest()` may also appear in the output.

## Notes

- Some specs create users and do not remove every row. Repeated runs can accumulate
  test users, but roles and settings are provided by migrations/seeds.
- The `customer` role must exist before running the tests.
- Integration tests do not require a running HTTP server.
