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

- Database Connection (PostgreSQL)
- Redis Connection (cache application settings and roles guard)
- Registration and Login (JWT Token)
- User Roles (Can be manage by admin)
- Two-Factor Authentication Setup (Using Email)
- Password Recovery
- Profile Information and Password Change
- Application Settings (Can be manage by admin)

### Test
- Unit
- Integration
- Load / Performance

### Request Extensions

- `req.credentials`: .jwt payload object from verified jwt header, .user() get the current authenticated user
  information, .authentication() details of token saved from database
- `req.sanitize`: .body form object, .query parameters
    - `.body.get(key, defaults?)`: get the specific value with default to NULL
    - `.body.only(string[])`: list the objects of selected keys
    - `.body.numeric(key, defaults?)`: convert the value if possible to numeric else default to 0
    - `.query.get(key, defaults?)`: get the specific value with default to NULL
    - `.query.numeric(key, defaults?)`: convert the value if possible to numeric else default to 0

### Getting Started

- Clone the repository

```
$ git clone https://github.com/teragrammer/expressjs-boilerplate.git
$ cd expressjs-boilerplate
```

- Configure your .env (.env.example)

- Initialize Docker

```
$ docker compose build --no-cache
$ docker compose up -d
$ sh scripts/docker.sh -r
```

- Manage the container with `scripts/docker.sh`:

```
$ sh scripts/docker.sh -r   # Run: start the container and open a bash shell
$ sh scripts/docker.sh -s   # Stop: stop the running container
$ sh scripts/docker.sh -d   # Destroy: tear down containers, images, networks, and volumes
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

- Project configuration: `opencode.json` (MCP servers, commands).
- Project skills: `.agents/skills/` (OpenCode-compatible; `.opencode/` is gitignored).
- Skills lock: `skills-lock.json` (reproducible skill installs).
- MCP helper: `scripts/mcp/postgres.mjs`.

#### Install / Initialize

```sh
npm install          # also runs "prepare" -> restores skills from skills-lock.json
npm run setup        # manual skill restore
npm run setup:check  # verify installed skills without changes
```

Manual skill install:

```sh
npx skills experimental_install
```

#### Installed Skills

Skills are sourced from open-source repositories via the `skills` CLI:

- `obra/superpowers` — brainstorming, systematic-debugging, test-driven-development, requesting/receiving-code-review, verification-before-completion, writing-plans, finishing-a-development-branch, using-git-worktrees, writing-skills
- `addyosmani/agent-skills` — security-and-hardening, documentation-and-adrs, performance-optimization, ci-cd-and-automation, observability-and-instrumentation, api-and-interface-design, code-simplification, incremental-implementation
- `anthropics/skills` — mcp-builder, skill-creator, doc-coauthoring
- `mattpocock/skills` — improve-codebase-architecture, domain-modeling, grill-with-docs, pr
- `wshobson/agents` — postgresql-table-design, typescript-advanced-types
- `github/awesome-copilot` — postgresql-code-review
- Local — auto-commit

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

The Postgres MCP server reads `DB_*` values from `.env` (or `DATABASE_URL`). For self-signed PostgreSQL TLS it uses `sslmode=no-verify`; adjust `scripts/mcp/postgres.mjs` or set `DATABASE_URL` for stricter TLS.

#### Troubleshooting

- Missing skills: run `npm run setup`.
- MCP server not connecting: ensure the package can be fetched (`npx -y ...`) and required env vars are set.
- Postgres MCP: set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` (or `DATABASE_URL`).
- `.opencode/` is gitignored; keep shared skills in `.agents/skills/` and config in `opencode.json`.

### Database Scripts

Run these from the repository root (they resolve paths relative to the current working directory):

- `npm run db:migrate` — apply all pending Kysely migrations.
- `npm run db:seed` — run all seeders in dependency order.
- `npm run db:reset` — run migrations followed by seeders.
- `npm run make:migration -- <snake_case_name>` — scaffold a new migration file under `database/migrations/`.
- `npm run make:seed -- <snake_case_name>` — scaffold a new seeder under `database/seeds/`.

After scaffolding a migration, register it in `src/config/migrator.ts` in timestamp order.
After scaffolding a seeder, wire it into `scripts/db/seed.ts` in dependency order.

### Example API Requests

- Authentication

```
curl -X POST https://localhost:3000/api/v1/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"123456"}'
```

### Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch (git checkout -b feature/your-feature).
3. Commit your changes (git commit -m 'Add your feature').
4. Push to the branch (git push origin feature/your-feature).
5. Open a Pull Request.
   Please ensure your code follows the project's coding standards and includes relevant tests.

### Hire Me

```
If you like this project and need help with development, customization, or integration, feel free to reach out!

I’m available for freelance work, consulting, and collaboration.

Thank you for checking out ExpressJS Boilerplate API for PostgreSQL!
Feel free to contribute or open issues.
```

### License

This project is licensed under the MIT License. See the LICENSE file for details.