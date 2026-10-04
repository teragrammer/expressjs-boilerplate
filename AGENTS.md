# AGENTS.md

Express 5 + TypeScript REST API boilerplate. Despite the README title and some comments, the database is **PostgreSQL** (`DB_CLIENT: "pg"`, default port 5432) — MySQL references in the README are stale.

## Commands

- `npm run dev` — nodemon + ts-node, watches `src/`
- `npm run build` — tsc compile. Gotcha: tsconfig `outDir` is `./dist`, but `npm run start` runs `node build/server.js`; the build/start pair is currently broken (output lands in `dist/`).
- `npm test` / `npm run test:run` — vitest. Always use these npm scripts instead of calling `npx vitest` directly: all tests share one database and the scripts enforce `--no-file-parallelism`.
- `npm run db:migrate` / `db:seed` / `db:reset` — Kysely via ts-node scripts in `scripts/db/` with the static registry in `src/config/migrator.ts`; must run from the repo root (migration/seed directories resolve from `process.cwd()`).
- `npm run make:migration` / `make:seed` — scaffold a new migration/seed file (register migrations in `src/config/migrator.ts`, wire seeds into `scripts/db/seed.ts`).
- Load tests: artillery against `tests/load/api.yml` (targets `localhost:3000`).

## Testing

- Every test run — including colocated unit tests — requires a reachable PostgreSQL: the global setup file `tests/integration/setup.ts` runs `migrate.latest()` before any test file executes.
- Unit tests live next to source (`src/**/*.spec.ts`); integration tests live in `tests/integration/`.
- Single file: `npx vitest run path/to/file.spec.ts --no-file-parallelism`.

## Architecture

- Entry flow: `src/index.ts` (optional cluster mode) → `src/app.ts` (Express app) → `src/routes/v1.ts` (module routers).
- No DI framework: all services and repositories are manually wired in `src/config/container.ts`. Register new dependencies there.
- Modules: `src/modules/{auth,users,system}`; `system` holds settings, roles, and route-guards. Redis cache/pub-sub lives in `src/shared/redis`.
- Request extensions (typed in `src/@types/express/index.d.ts`): `req.credentials`, `req.sanitize.body/query`, `req.pagination`, `res.failed.message/fields`. Use these in controllers instead of raw `req.body` / `res.json`.
- Async route handlers must be wrapped in `catchAsync` (`src/common/utils/catch-async.ts`), otherwise rejections never reach the error middleware.
- Cluster mode: set `CLUSTER=true`; worker count defaults to CPU count (`CLUSTER_WORKERS` overrides).
- Redis is optional — without `REDIS_HOST` the app boots in database-only fallback mode. PostgreSQL is required; the process exits if the DB connection check fails.

## Setup notes

- Copy `.env.example` to `.env`. Boolean env vars are exact string comparisons: only `"true"` enables them (`CLUSTER=1` will not work).
- `docker compose up -d` starts only the app container (see `compose.yml`); PostgreSQL and Redis are expected to be provided externally.
