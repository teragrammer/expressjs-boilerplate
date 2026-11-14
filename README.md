# ExpressJS Boilerplate API

![Build Status](https://github.com/teragrammer/expressjs-boilerplate/actions/workflows/test.yml/badge.svg)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![Express.js](https://img.shields.io/badge/express.js-%23404d59.svg?style=flat&logo=express&logoColor=%2361DAFB)
![Node.js](https://img.shields.io/badge/node.js-%23339933.svg?style=flat&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%233178C6.svg?style=flat&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/postgresql-%234169E1.svg?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?style=flat&logo=redis&logoColor=white)
![Vitest](https://img.shields.io/badge/vitest-%236E9F1.svg?style=flat&logo=vitest&logoColor=white)
![Kysely](https://img.shields.io/badge/kysely-%23E5853B.svg?style=flat&logo=typescript&logoColor=white)

A minimal and clean Express.js boilerplate for building RESTful APIs quickly.
This starter template includes essential features like routing, middleware setup, error handling, and
environment configuration to help you kickstart your API development with best practices.

### Features

**Authentication and sessions**

- Registration and login with short-lived access tokens and rotating,
  hashed refresh tokens delivered in an `HttpOnly` cookie
- Every access token references a live database session, so revocation,
  expiry and account status take effect immediately
- Two-factor authentication with an email one-time password, a policy
  (`disabled`, `per_user`, `global`), enrollment and recovery codes
- Password recovery that never reveals whether an account exists,
  resets atomically and revokes every session
- Email and phone verification
- Layered rate limiting on login, registration, recovery, OTP and
  verification endpoints

**Authorization**

- Route guards with a canonical, seeded route catalog
- An `authorization_version` on the user, so a role or status change
  takes effect on the next request
- Field-level authorization: only an administrator can change
  `role_id`, `status` or another user's password
- Soft delete for users and restrictive foreign keys, so a role can
  never delete its users

**Platform**

- PostgreSQL through Kysely, with typed schemas, an explicit migration
  registry and a reviewed seed
- Optional Redis cache for settings and route guards, encrypted with
  AES-256-GCM and invalidated over pub/sub
- A durable outbox: email is delivered by a background worker, never
  inside a request or a transaction
- An append-only audit trail with a read API
- Structured logs with a request id, redaction, Prometheus metrics and
  health/readiness probes
- Graceful shutdown, a non-root production container and CI quality
  gates (lint, typecheck, build, tests, coverage, dependency audit,
  image scan)

**API**

- An OpenAPI 3.1 contract in [`docs/openapi.yaml`](docs/openapi.yaml),
  validated against the real routes in CI
- Consistent error envelope and PostgreSQL error mapping
- `Idempotency-Key` support on unsafe endpoints
- Cursor pagination for users, offset pagination for admin tables

### Testing

The project includes unit, integration, and load/performance tests.

- **Unit tests** — colocated with source as `src/**/*.spec.ts`.
- **Integration tests** — grouped under `tests/integration/{auth,users,system}/`; run against PostgreSQL.
  See [docs/testing/integration.md](docs/testing/integration.md).
- **Load / performance tests** — Artillery configs in `tests/load/`.
  See [docs/testing/load-performance.md](docs/testing/load-performance.md).

Quick start:

```bash
npm test              # watch mode
npm run test:run      # single run
npm run test:coverage # with coverage
npm run load:test:smoke
```

Other quality commands:

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # eslint
npm run build         # compile to dist/
npm run openapi:lint  # validate the contract against the routes
npm run audit:prod    # dependency audit (production tree)
```

Every command must pass before a change is merged. The CI workflow runs
all of them.

### Request Extensions

- `req.credentials`: `.jwt` payload object from the verified JWT header, `.user()` gets the
  current authenticated user, `.authentication()` returns the session record
- `req.sanitize`: `.body` form object, `.query` parameters, `.data` the validated payload
    - `.body.get(key, defaults?)`: get the specific value with default to NULL
    - `.body.only(string[])`: list the objects of selected keys
    - `.body.numeric(key, defaults?)`: convert the value if possible to numeric else default to 0
    - `.query.get(key, defaults?)`: get the specific value with default to NULL
    - `.query.numeric(key, defaults?)`: convert the value if possible to numeric else default to 0
- `req.pagination`: `page`, `offset` and `perPage` for the admin lists
- `req.cursorPagination`: `cursor` and `perPage` for the user list
- `req.context`: the per-request context (request id, ip, user id)

> Browse filters should be parsed with `src/common/utils/query-parser.ts`.
> It keeps an absent parameter absent (rather than turning it into `0`)
> and rejects invalid values with a 400 instead of silently coercing
> them.

### Getting Started

- Clone the repository

```
$ git clone https://github.com/teragrammer/expressjs-boilerplate.git
$ cd expressjs-boilerplate
```

- Configure your .env (.env.example)

- Start the stack (the application, PostgreSQL and Redis)

```
$ docker compose up -d --build
```

The compose file builds the production image, reads the configuration
from `.env` and waits for the database and the cache to become healthy.

- Build and run the production image directly

```
$ docker build -t express-api .
$ docker run --rm -p 4000:4000 --env-file .env express-api
```

- Install dependencies

```
$ npm install
```

- Run test to check if all functions and configuration is set correctly (optional)

```
$ npm test
```

- Start the server (development)

```
$ npm run dev
```

- Production build

```
$ npm run build
$ npm run start
```

### OpenCode Integration

This repository is configured for [OpenCode](https://opencode.ai) as the primary coding agent.

**Version-controlled configuration**

- Project configuration: `opencode.json` (MCP servers, commands).
- Skills lock: `skills-lock.json` (reproducible skill installs).
- MCP helper: `scripts/mcp/postgres.mjs`.
- Local skill: `.agents/skills/auto-commit/SKILL.md` (not published in a skill repository).

**Local-only files (gitignored)**

- `.opencode/` — local OpenCode commands, skills, and state. Shared commands belong in `opencode.json`.
- `.agents/skills/*` — skills materialized by the `skills` CLI. They are restored from `skills-lock.json`, so they are not committed. The local `auto-commit` skill is the exception and remains tracked.

#### Install / Initialize

From a fresh clone, install the OpenCode CLI from <https://opencode.ai> if you do not already have it, then run:

```sh
cp .env.example .env
npm install          # installs dependencies and restores skills from skills-lock.json
npm run setup:check  # verify the installed skill set without changing it
opencode mcp list    # verify the MCP servers
opencode             # start OpenCode
```

`npm install` runs the `prepare` script, which executes `npm run setup` (`npx skills experimental_install`). The hook is skipped when `CI` is set or `NODE_ENV=production` (for example in GitHub Actions and Docker builds), so dependency installation does not depend on cloning skill repositories. To restore or repair the skill installation manually:

```sh
npm run setup        # restore skills from skills-lock.json
npm run setup:check  # dry run; report missing or changed skills
npx skills experimental_install  # equivalent direct CLI command
```

#### Installed Skills

Skills are sourced from open-source repositories via the `skills` CLI:

- `obra/superpowers` — brainstorming, systematic-debugging, test-driven-development, requesting/receiving-code-review, verification-before-completion, writing-plans, finishing-a-development-branch, using-git-worktrees, writing-skills
- `addyosmani/agent-skills` — security-and-hardening, documentation-and-adrs, performance-optimization, ci-cd-and-automation, observability-and-instrumentation, api-and-interface-design, code-simplification, incremental-implementation
- `anthropics/skills` — mcp-builder, skill-creator, doc-coauthoring
- `mattpocock/skills` — improve-codebase-architecture, domain-modeling, grill-with-docs, pr
- `wshobson/agents` — postgresql-table-design, typescript-advanced-types
- `github/awesome-copilot` — postgresql-code-review
- Local — auto-commit (checked in at `.agents/skills/auto-commit/SKILL.md`)

#### MCP Servers

Configured in `opencode.json` (all free and open source):

- `filesystem` — `@modelcontextprotocol/server-filesystem` — project file access
- `memory` — `@modelcontextprotocol/server-memory` — persistent knowledge graph
- `sequential-thinking` — `@modelcontextprotocol/server-sequential-thinking` — structured reasoning
- `postgres` — `@modelcontextprotocol/server-postgres` (via `scripts/mcp/postgres.mjs`) — read-only PostgreSQL queries
- `context7` — remote (https://mcp.context7.com/mcp) — up-to-date library documentation

Verify MCP servers:

```sh
opencode mcp list
```

The Postgres MCP server reads `DB_*` values from `.env` (or `DATABASE_URL`). TLS connections use `sslmode=verify-full`; when `DB_SSL_CA` is set it is passed as `sslrootcert`. For a self-signed server, point `DB_SSL_CA` at the issuing CA (or use a `DATABASE_URL` that names a trusted CA). `sslmode=no-verify` is rejected by the helper.

#### Troubleshooting

- Missing skills: run `npm run setup`.
- MCP server not connecting: ensure the package can be fetched (`npx -y ...`) and required env vars are set.
- Postgres MCP: set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` (or `DATABASE_URL`).
- `.opencode/` and generated skills in `.agents/skills/` are gitignored. Keep shared commands and MCP servers in `opencode.json`, and restore generated skills from `skills-lock.json`. The local `auto-commit` skill is the exception and remains tracked.

### Operational Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /health/live` | Liveness. The process is up; no dependency is contacted. |
| `GET /health/ready` | Readiness. Checks PostgreSQL (and Redis when configured). Returns 503 when a dependency is down. |
| `GET /metrics` | Prometheus metrics. Restrict this to an operator network. |

### Documentation

- [`docs/openapi.yaml`](docs/openapi.yaml) — the API contract
- Swagger UI: `http://localhost:4000/api-docs` (OpenAPI spec: `/openapi.yaml`, `/openapi.json`)
- [`docs/adr/`](docs/adr/) — the architecture decision records
- [`docs/runbooks/`](docs/runbooks/) — deployment, migrations, incident
  response and backup procedures

### Database Scripts

Run these from the repository root (they resolve paths relative to the current working directory):

- `npm run db:migrate` — apply all pending Kysely migrations.
- `npm run db:seed` — run all seeders in dependency order.
- `npm run db:reset` — run migrations followed by seeders.
- `npm run make:migration -- <snake_case_name>` — scaffold a new migration file under `database/migrations/`.
- `npm run make:seed -- <snake_case_name>` — scaffold a new seeder under `database/seeds/`.

After scaffolding a migration, register it in `src/config/migrator.ts` in timestamp order.
After scaffolding a seeder, wire it into `scripts/db/seed.ts` in dependency order.

#### Migration Naming Convention (Required)

All Kysely migration files in `database/migrations/` must follow this format:

`YYYYMMDDHHmmss_descriptive_action_and_table.ts`

- `YYYYMMDDHHmmss` is a 14-digit timestamp (`YYYY` year, `MM` month, `DD` day, `HH` hour, `mm` minute, `ss` second).
- The descriptive part uses lowercase `snake_case` and clearly states the action and affected table.
- Every migration filename must have a unique timestamp prefix.
- Preserve chronological execution order when registering migrations.

Examples:
- `20261111120000_create_users_table.ts`
- `20261111121500_add_email_to_users.ts`
- `20261111123000_create_organizations_table.ts`
- `20261111124500_add_organization_id_to_users.ts`
- `20261111130000_create_user_sessions_table.ts`

### Example API Requests

- Log in (the refresh token is returned as an `HttpOnly` cookie)

```
curl -i -X POST http://localhost:4000/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -c cookies.txt \
    -d '{"username":"customer","password":"<password>"}'
```

- Refresh the access token

```
curl -X POST http://localhost:4000/api/v1/auth/refresh -b cookies.txt
```

- Call an authorized endpoint

```
curl http://localhost:4000/api/v1/users \
    -H "Authorization: Bearer <access_token>"
```

- Browse users with cursor pagination

```
curl "http://localhost:4000/api/v1/users?per_page=20&cursor=481" \
    -H "Authorization: Bearer <access_token>"
```

> The pagination parameter is `per_page`, not `limit`.

- Read the public settings (no authentication required)

```
curl http://localhost:4000/api/v1/settings/values
```

The full contract is in [`docs/openapi.yaml`](docs/openapi.yaml).

### Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (git checkout -b feature/your-feature).
3. Commit your changes (git commit -m 'Add your feature').
4. Push to the branch (git push origin feature/your-feature).
5. Open a Pull Request.
   Please ensure your code follows the project's coding standards and includes relevant tests.

### Hire Me

I build and maintain production-ready Node.js APIs with Express, TypeScript, and PostgreSQL. This boilerplate reflects how I work: typed end to end, security-conscious, tested, and documented.

If you need help with:

- **API development** — new endpoints, authentication, authorization, background jobs, or a service built from scratch.
- **Customization** — adapting this boilerplate to your domain, database, or deployment environment.
- **Integration** — connecting payments, email, queues, observability, or third-party APIs.
- **Security and reliability** — reviewing authentication and session flows, hardening endpoints, fixing performance bottlenecks, or improving test coverage.
- **Consulting** — architecture reviews, code reviews, or hands-on help for your team.

I’m available for freelance projects, consulting engagements, and collaboration. Tell me what you’re building and what you need, and I’ll reply with a clear scope and next steps.

- GitHub: [@teragrammer](https://github.com/teragrammer)
- Email: [teragrammer@proton.me](mailto:teragrammer@proton.me)

Thanks for checking out the project. Contributions and issues are always welcome.

### License

This project is licensed under the MIT License. See the LICENSE file for details.