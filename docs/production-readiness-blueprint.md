# Production Readiness and Feature Blueprint

**Project:** Express.js 5 + TypeScript + PostgreSQL API boilerplate
**Document date:** 2026-11-11
**Scope:** Architecture, security, performance, database, testing, and implementation status
**Status:** Assessment record plus post-implementation status

> **Evidence standard.** The assessment is based on a full repository read (configuration, migrations, routes, middleware, services, repositories, tests, CI, container files) plus `tsc --noEmit`, `npm run lint`, `npm run db:migrate`, a database connectivity check, and read-only validation probes.
>
> **Document status.** Sections 1.4 and 8 record the implementation that followed the assessment. Sections 4 and 5 describe the state *before* that work and are kept as the record of what was found. The checklists in Section 13 reflect the implemented state.

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Overview](#2-project-overview)
3. [Existing Architecture and Features](#3-existing-architecture-and-features)
4. [Current Implementation Assessment](#4-current-implementation-assessment)
5. [Identified Gaps and Technical Debt](#5-identified-gaps-and-technical-debt)
6. [Security Assessment](#6-security-assessment)
7. [Performance and Database Assessment](#7-performance-and-database-assessment)
8. [Recommended Features](#8-recommended-features)
9. [Testing Strategy](#9-testing-strategy)
10. [Recommended Architecture and Technology Stack](#10-recommended-architecture-and-technology-stack)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Dependencies and Implementation Order](#12-dependencies-and-implementation-order)
13. [Production Readiness Checklist](#13-production-readiness-checklist)
14. [References and Research Sources](#14-references-and-research-sources)

### Status and Priority Conventions

| Label | Meaning |
| --- | --- |
| **Existing** | Implemented and verified by code inspection; may still have documented defects. |
| **Incomplete** | Present but broken, inconsistent, unenforced, or missing part of a workflow. |
| **Missing** | Not implemented. |
| **Recommended** | Proposed work not currently in the repository. |
| **P0** | Blocks production use: security, data-loss, or core functional defect. Fix first. |
| **P1** | Required for a credible production deployment. |
| **P2** | Scale, maturity, or efficiency improvement. |
| **P3** | Optional or product-dependent. Defer until there is a concrete need. |

**Complexity (one experienced engineer):** S = under 1 day; M = 1–3 days; L = 3–10 days; XL = over 10 days. Estimates exclude review, deployment, and product-specific work.

### Document map

| Need | Document |
| --- | --- |
| API contract | [`openapi.yaml`](openapi.yaml) |
| Architecture decisions | [`adr/README.md`](adr/README.md) |
| Deployment, migrations, backup, incidents | [`runbooks/`](runbooks/) |
| Integration and load tests | [`testing/integration.md`](testing/integration.md), [`testing/load-performance.md`](testing/load-performance.md) |
| Documentation index | [`README.md`](README.md) |

---

## 1. Executive Summary

### 1.1 Overall Verdict

The repository is a credible modular-monolith foundation, not a disposable prototype. It uses Express 5, strict TypeScript, Kysely with parameterized SQL, PostgreSQL, optional Redis caching, Joi validation, JWT plus database-backed sessions, bcrypt with a pepper, Helmet, compression, cursor pagination for users, migrations, seeds, unit tests, integration tests, and Artillery load-test configurations. Routing and middleware feed controllers, controllers call services, services use repositories, and repositories use Kysely.

At assessment it was **not production-ready**. The serious problems were broken security invariants and core functional defects in authentication, session, authorization, and validation paths, not missing nice-to-have features:

1. Admin user creation/update always failed validation (`roles.role_id` does not exist).
2. Scalar uniqueness validation was ineffective; duplicate registration reached the database.
3. Account updates minted `tid: 0` tokens without role/bypass claims.
4. Session expiry was not enforced.
5. Account status was ignored at login; status changes did not revoke sessions.
6. Role deletion cascaded to users; user deletion was a hard delete.
7. Authentication abuse controls were missing or defective.
8. Password recovery leaked account existence, was non-atomic, and did not revoke sessions.
9. Empty secrets, wildcard CORS, and a 60-day JWT were accepted.
10. Several admin browse endpoints and the settings cache were broken.
11. Operational readiness was thin: no request IDs, structured logs, redaction, probes, metrics, audit, OpenAPI, outbox, or cleanup.

All P0 items and most P1/P2 items have since been implemented. See Section 1.4 and Section 8.

### 1.2 Highest-Risk Findings

| # | Finding | Why it matters | Priority |
| --- | --- | --- | --- |
| 1 | Scalar uniqueness and role-existence validation broken | Admin user management unusable; duplicate registration returned a generic 500 | P0 |
| 2 | `tid: 0` tokens bypass session checks and lack claims | Revocation bypassed; account endpoints issued unusable tokens | P0 |
| 3 | Expired sessions accepted | Old/stolen JWTs remained valid beyond the session lifetime | P0 |
| 4 | Login ignored user status | Suspended/deactivated users retained access | P0 |
| 5 | Role deletion cascaded to users; user deletion hard | Routine admin action destroyed accounts and audit evidence | P0 |
| 6 | No auth rate limiting; lockout/TFA defects | Credential stuffing, OTP brute force, email bombing | P0 |
| 7 | Password recovery leaked existence and did not revoke sessions | Enumeration and continued use of stolen sessions | P0 |
| 8 | TFA not enforced consistently | Account routes demanded `tfa`; login never required it | P0 |
| 9 | Wildcard CORS, unvalidated secrets, 60-day JWT | Unsafe defaults could reach production | P0 |
| 10 | Admin browse and settings cache broken | Admin workflows failed or hammered the database | P1 |
| 11 | No observability, audit, or production container/CI gates | Incidents hard to detect, investigate, or prevent | P1 |

### 1.3 Recommended Direction

Do not add product features before closing P0 items. Sequence:

1. **Repair correctness:** validation, user create/update, account tokens, session expiry, status enforcement, deletion semantics.
2. **Harden authentication and authorization:** abuse controls, TFA, atomic non-enumerating recovery, fresh authorization state.
3. **Build production plumbing:** refresh tokens, verification, audit, observability, constraints/indexes, transactions, seeds, CI, production container.
4. **Then add scale/maturity features:** OpenAPI, outbox jobs, idempotency, permission normalization, advanced search, optional SSO/passkeys.

Planning estimate: **12–16 person-weeks** for one senior engineer, or **6–8 calendar weeks with two engineers**. P0 is roughly 4–6 person-weeks; P1 is roughly 6–10 person-weeks. These are planning estimates, not commitments.

### 1.4 Implementation Status

| Area | State |
| --- | --- |
| P0 (F-01 to F-10) | Implemented and covered by the regression suite. |
| P1 (F-11 to F-23, F-25) | Implemented. |
| P2 (F-24, F-26 to F-29) | Implemented, except F-27 which is partially implemented: field-level rules and ownership checks exist, but there is no generalized policy layer for every resource type. |
| P3 (F-30) | Deferred until a funded requirement and written ADR exist. See [`adr/README.md`](adr/README.md). |

| Concern | Location |
| --- | --- |
| Session and token authority | `src/modules/auth/authentication/session.service.ts` |
| Request context and logging | `src/common/context/`, `src/common/middleware/request-context.middleware.ts` |
| Error taxonomy | `src/common/utils/db-error.mapper.ts`, `src/common/utils/messages.ts` |
| Authorization policy | `src/common/authz/policy.ts`, `src/modules/system/route-guards/route-guard.catalog.ts` |
| Audit trail | `src/modules/audit/` |
| Outbox and cleanup | `src/modules/jobs/` |
| Verification | `src/modules/auth/verification/` |
| Operational endpoints | `src/modules/system/health/`, `src/routes/metrics.ts` |
| Contract | `openapi.yaml`, validated by `scripts/openapi-lint.ts` |
| Decisions | `adr/` |
| Procedures | `runbooks/` |
| Regression suite | `tests/integration/system/regression.spec.ts`, `tests/integration/auth/session.spec.ts` |

Verification commands: `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:run`, `npm run test:coverage`, `npm run openapi:lint`, `npm run audit:prod`.

### 1.5 Explicit Non-Goals

- Splitting the system into microservices.
- Replacing Express, Kysely, or PostgreSQL.
- Introducing GraphQL, Kafka, or a separate authentication service.
- Adding multi-tenancy before a real tenant requirement exists.
- Rewriting the application from scratch.
- Adding features not tied to a verified risk or operational need.

The modular monolith is the right architecture for this codebase. The work is to make its invariants explicit, tested, and enforceable.

---

## 2. Project Overview

### 2.1 Purpose

A REST API boilerplate for authenticated applications:

- PostgreSQL persistence through Kysely.
- Optional Redis caching and pub/sub.
- Registration, login, logout, JWT sessions, and database session records.
- Role-based route guards with an admin bypass flag.
- Email-based two-factor authentication (OTP).
- Email/phone password recovery.
- Account profile and password changes.
- Admin management of users, roles, settings, and route guards.
- Unit, integration, and Artillery load-test scaffolding.
- Kysely migrations and seeders.

### 2.2 Technology Stack

| Layer | Technology | Notes |
| --- | --- | --- |
| Runtime | Node.js | CI and Dockerfile use Node 24 |
| Language | TypeScript | `^6.0.3`, `strict: true`, target `ES6` |
| HTTP | Express | `^5.3.0` |
| Database | PostgreSQL | `pg` `^8.23.1`; Kysely `0.29.8` |
| Cache / pub-sub | Redis | `ioredis` `^6.0.0`; optional at boot |
| Validation | Joi | `^18.3.2`, custom phone extension |
| Auth | `jsonwebtoken` | `^9.0.3`; HS256 pinned |
| Password hashing | `bcrypt` | `^6.0.0`; pepper via `BCRYPT_SECRET` |
| Encryption | Node `crypto` | AES-256-GCM for Redis cache payloads |
| Logging / metrics | Pino, pino-pretty, Prometheus client | JSON in production; `/metrics` |
| Email | SendGrid | `@sendgrid/mail` `^8.1.6` |
| Testing | Vitest + Supertest | Unit, integration, regression |
| Load testing | Artillery | `^2.0.34` |
| Container | `node:24-bookworm-slim` | Multi-stage, non-root, `tini` |
| CI | GitHub Actions | Lint, typecheck, build, tests, coverage, audit, image scan, SBOM |

### 2.3 Repository Layout

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Process entry; optional cluster; HTTP server; shutdown |
| `src/app.ts` | Express app assembly; middleware; `/api/v1`; 404; error handler |
| `src/bootstrap.ts` | Cache warm-up and Redis subscriptions |
| `src/routes/v1.ts` | Module router composition |
| `src/config/` | Environment, database, Redis, HTTP, logger, schema, migrator, container |
| `src/common/middleware/` | Sanitization/pagination, responses, errors, validation, authN/authZ, TFA, rate limit, idempotency |
| `src/common/utils/` | Errors, messages, dates, security primitives, `catchAsync`, DB error mapper |
| `src/common/authz/`, `src/common/context/`, `src/common/metrics/` | Policy, request context, metrics |
| `src/modules/auth/` | Authentication, sessions, TFA, password recovery, verification |
| `src/modules/users/` | Users, account profile/password |
| `src/modules/system/` | Settings, roles, route guards, health |
| `src/modules/audit/`, `src/modules/jobs/` | Audit trail; outbox worker and cleanup |
| `src/shared/redis/` | Encrypted cache and pub/sub subscriber |
| `src/shared/validations/` | Joi extensions and database uniqueness/existence validators |
| `src/infrastructure/mail/` | SendGrid adapter |
| `database/migrations/` | 14 Kysely migrations |
| `database/seeds/` | Idempotent users/roles and settings seeds |
| `tests/integration/` | HTTP integration, regression, session, and cleanup suites |
| `tests/load/` | Artillery configs, data, hooks, runner |
| `docs/` | This documentation set |
| `.github/workflows/test.yml` | CI workflow |

### 2.4 Runtime Request Flow

```text
Client
  |
  v
src/index.ts (optional cluster primary/worker)
  |
  v
src/app.ts
  |-- helmet, hpp, CORS, compression, user-agent, request logging
  |-- requestHandler: XSS sanitization + pagination context
  |-- responseHandler: res.failed helpers
  |-- /api/v1
  |     |-- /auth
  |     |-- /account
  |     |-- /users
  |     |-- /settings
  |     |-- /roles
  |     |-- /route/guards
  |     |-- /audit
  |-- 404 handler
  |-- errorHandler
  |
  v
Route middleware
  |-- AuthenticationMiddleware: verify JWT; load live session and user status
  |-- AuthorizationMiddleware: check role slug against cached route guards
  |-- TwoFactorAuthenticationMiddleware: require jwt.tfa
  |-- RateLimit / Idempotency where configured
  |-- validate: sanitize selected fields; Joi validateAsync
  |
  v
Controller -> Service -> Repository -> Kysely -> PostgreSQL
                              |
                              +-> Redis cache/pub-sub (optional)
                              +-> Outbox worker (email, cleanup)
                              +-> SendGrid (password recovery / OTP)
```

### 2.5 Data Model

| Table | Purpose | Key constraints / indexes |
| --- | --- | --- |
| `settings` | Runtime configuration | `name` unique, `slug` unique; `is_disabled`, `is_public` |
| `roles` | Role catalog | `slug` unique; `is_bypass_authorization`; index on `created_at` |
| `users` | Accounts | `phone`, `email`, `username` unique; `role_id` FK `ON DELETE RESTRICT`; status/gender checks; `authorization_version`; `deleted_at`; browse indexes on `(deleted_at, role_id, status, id)`, `(deleted_at, status, id)`, `(deleted_at, role_id, id)`, `(deleted_at, id)` |
| `authentication_tokens` | Revocable sessions | `user_id` FK `ON DELETE RESTRICT`; `expired_at NOT NULL`; indexes on `user_id`, `expired_at`, `created_at` |
| `two_factor_authentications` | Email OTP state | `token_id` unique FK `ON DELETE RESTRICT`; `tries`, `next_send_at`, `expired_tries_at`, `expired_at`; index `(token_id, expired_at)` |
| `tfa_recovery_codes` | TFA recovery codes | `user_id` FK; `code_hash` |
| `password_recoveries` | Recovery codes | Unique `(type, send_to)`; type check; indexes on `(type, send_to)`, `next_resend_at`, `expired_at`, `next_try_at` |
| `route_guards` | Role-to-route allow list | `role_id` FK `ON DELETE RESTRICT`; unique `(role_id, route)`; index on `role_id` |
| `rate_limits` | Rate-limit counters | `key`, `bucket`, `count`, `expires_at` |
| `refresh_tokens` | Rotating refresh tokens | `session_id`, `user_id`, `token_hash`, `family_id`, `expires_at`, `revoked_at`, `replaced_by` |
| `verification_tokens` | Email/phone verification | `user_id`, `channel`, `target`, `token_hash`, `expires_at`, `consumed_at`, `attempts` |
| `audit_logs` | Append-only audit trail | `occurred_at`, actor/action/target/outcome, `request_id`, `ip`, `user_agent`, `metadata` |
| `outbox_events` | Durable async work | `type`, `payload`, `status`, `attempts`, `available_at`, `locked_at`, `locked_by`, `last_error` |
| `idempotency_keys` | Retry-safe writes | `key`, `user_id`, `route`, `request_hash`, `status`, `response_status`, `response_body`, `expires_at` |

### 2.6 API Surface

All paths are prefixed with `/api/v1`. The machine-readable contract is [`openapi.yaml`](openapi.yaml).

| Method | Path | Authentication | Authorization | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | — | Creates a customer user and returns tokens |
| POST | `/auth/login` | Public | — | Returns access token; may return a TFA-restricted token |
| POST | `/auth/refresh` | Refresh cookie | — | Rotates the refresh token |
| POST | `/auth/logout` | Bearer | — | Revokes the current session |
| POST | `/auth/logout-all` | Bearer | — | Revokes every session |
| GET | `/auth/sessions` | Bearer | — | Lists active sessions |
| POST | `/auth/password-recovery/send` | Public | — | Constant response; no account enumeration |
| POST | `/auth/password-recovery/validate` | Public | — | Atomic reset; revokes sessions |
| POST | `/auth/tfa/send`, `/auth/tfa/validate` | Bearer | — | OTP challenge and verification |
| POST | `/auth/tfa/enroll`, `/auth/tfa/enroll/send`, `/auth/tfa/recovery`, `/auth/tfa/disable` | Bearer | — | TFA enrollment and recovery |
| PUT | `/account/information` | Bearer + `tfa` | — | Updates profile |
| PUT | `/account/password` | Bearer + `tfa` | — | Changes credentials |
| POST | `/account/email/verification/send`, `/confirm` | Bearer | — | Email verification |
| POST | `/account/phone/verification/send`, `/confirm` | Bearer | — | Phone verification |
| POST/PUT/GET/DELETE | `/users`, `/users/:id`, `/users/:id/purge` | Bearer | `users:*` | Admin user CRUD; soft delete; privileged purge |
| POST/PUT/GET/DELETE | `/settings`, `/settings/values`, `/settings/:id` | Bearer (except `/values`) | `settings:*` | Settings CRUD and cached public values |
| POST/PUT/GET/DELETE | `/roles`, `/roles/:id` | Bearer | `roles:*` | Role CRUD |
| POST/GET/DELETE | `/route/guards`, `/route/guards/:id` | Bearer | `route-guards:*` | Route-guard CRUD |
| GET | `/audit` | Bearer | `audit:*` | Audit trail read API |
| GET | `/health/live`, `/health/ready` | Public | — | Liveness/readiness |
| GET | `/metrics` | Public (restrict at network) | — | Prometheus metrics |

### 2.7 Configuration Surface

| Variable | Default / behavior | Notes |
| --- | --- | --- |
| `NODE_ENV` | required | Must be set explicitly; `production` enables fail-closed rules |
| `PORT` / `PORT_EXPOSE` | `4000` / `5000` | HTTP port and exposed port |
| `HAS_PROXY` | `false` | Required for correct `req.ip` behind a proxy |
| `CORS_ORIGINS` | empty | Production requires an explicit allowlist; wildcard + credentials rejected |
| `CLUSTER` / `CLUSTER_WORKERS` | `false` / CPU count | Empty or unset defaults to CPU count; positive integer otherwise |
| `DB_*` | host/user/pass/name | Validated at boot; production requires TLS for remote endpoints |
| `DB_POOL_MIN` / `MAX` | `2` / `10` per worker | Boot fails if total exceeds `DB_MAX_CONNECTIONS_TOTAL` |
| `DB_SSL` / `DB_SSL_REJECT_UNAUTHORIZED` | `false` / `true` when SSL enabled | Production requires verification; CA/cert/key paths validated and cert/key must be paired |
| `REDIS_*` | optional | Without `REDIS_HOST`, app runs in database-only fallback mode; TLS certificates are always verified |
| `SENDGRID_API_KEY` | empty | Required when email features are enabled |
| `JWT_SECRET` | required | Minimum length and non-placeholder enforced; rotating it invalidates sessions |
| `JWT_ACCESS_TOKEN_MINUTES` | `15` | Short-lived access token |
| `BCRYPT_SECRET` | required | Server-side pepper; non-placeholder enforced |
| `BCRYPT_SALT_ROUND` | `12` | Validated integer |
| `CRYPT0_SECRET` | required | 32 bytes; HKDF-derived AES-256-GCM cache key; non-placeholder enforced |
| `CRYPT0_CIPHER` | `aes-256-gcm` | Authenticated encryption |
| `SEED_PASSWORD` | required for seeding | Never generated or logged; seeding is refused in production |

### 2.8 Testing and Deployment Assets

| Asset | Current state |
| --- | --- |
| Unit tests | 46 colocated `src/**/*.spec.ts` files |
| Integration tests | account, cleanup, login, password recovery, register, regression, session, TFA, two-factor authentication |
| Full suite | 55 files / 697 tests passing (`npm run test:run`, measured 2026-11-12) |
| Load tests | Artillery smoke/default/stress/soak |
| CI | Lint, typecheck, build, OpenAPI lint, audit, tests, coverage, image build/scan, SBOM |
| Container | Multi-stage `node:24-bookworm-slim`, non-root, `tini`, healthcheck |
| Compose | Single `web` service with `env_file` and healthcheck; PostgreSQL/Redis are expected externally |
| Docs | This blueprint, ADRs, runbooks, testing guides, OpenAPI |

---

## 3. Existing Architecture and Features

### 3.1 Architecture Style

The application is a **modular monolith** with manual dependency injection. `src/config/container.ts` constructs repositories, services, the mail adapter, cache components, and event handlers. Routes must not instantiate services directly.

Layering:

- **HTTP layer:** Express routes, middleware, controllers.
- **Application layer:** authentication, account, user, TFA, recovery, settings, role, route-guard, verification, audit, jobs.
- **Persistence layer:** repositories using Kysely; `DatabaseExecutor` supports the shared database and transactions.
- **Cross-cutting:** validation, errors, security utilities, cache, mail, metrics, request context.

### 3.2 Module Inventory

| Module | Responsibilities | Notes |
| --- | --- | --- |
| `auth/authentication` | Register, login, logout, JWT issuance/verification, sessions | Session-bound tokens, status/expiry checks |
| `auth/two-factor-authentication` | OTP issue/verify, enrollment, recovery codes | Policy-driven; lockout repaired |
| `auth/password-recovery` | Email/phone recovery codes, atomic reset | Outbox email; sessions revoked |
| `auth/verification` | Email/phone verification tokens | Flags reset on contact change |
| `users` | User CRUD, cursor browse, account profile/password | Soft delete; field-level policy |
| `system/settings` | Settings CRUD, typed values, cache | Cached public values |
| `system/roles` | Role CRUD | Delete blocked while referenced |
| `system/route-guards` | Role-to-route mappings, cached authorization | Unique `(role_id, route)`; seeded catalog |
| `system/health` | Liveness/readiness | PostgreSQL/Redis checks |
| `audit` | Append-only audit trail | Actor/action/target/outcome/request ID |
| `jobs` | Outbox worker and cleanup | `FOR UPDATE SKIP LOCKED`; retries/DLQ |
| `shared/redis` | Encrypted cache, pub/sub | AES-256-GCM; TTL; reconnect |
| `infrastructure/mail` | SendGrid adapter | TLS verification; outbox delivery |

### 3.3 Feature Matrix (Assessment Snapshot)

| Feature | Status at assessment | Current state |
| --- | --- | --- |
| PostgreSQL connection/health check | Existing | Boot check plus HTTP probes |
| Kysely migrations | Existing (7) | 14 migrations, static registry |
| Seeders | Incomplete | Idempotent; canonical route guards; `SEED_PASSWORD` |
| Registration | Incomplete | Atomic; duplicate → 409; verification available |
| Login | Incomplete | Status, lockout, rate limits enforced |
| JWT issuance/verification | Incomplete | `iss`/`aud`/`jti`; pinned HS256; short-lived |
| Revocable sessions | Incomplete | Live session check; refresh rotation/reuse detection |
| Logout | Existing | Current session, logout-all, session listing |
| Role-based route guards | Incomplete | Seeded catalog; unique/index; `authorization_version` |
| TFA email OTP | Incomplete | Enforced by policy; enrollment; lockout repaired |
| Password recovery | Incomplete | Constant response; atomic; sessions revoked; outbox |
| Account profile/password | Incomplete | Session-bound tokens; verification flags |
| Admin user CRUD | Incomplete | Works; soft delete; privileged purge |
| Settings management | Incomplete | Browse fixed; `/values` cached/public |
| Role management | Incomplete | Delete restricted while referenced |
| Route-guard management | Incomplete | Unique/index; browse fixed |
| Input sanitization/validation | Incomplete | Scalar/composite uniqueness fixed |
| Redis cache/pub-sub | Incomplete | AES-GCM; L1 TTL; reconnect; fallback |
| Unit tests | Existing (34) | 46 files |
| Integration tests | Existing (5) | 9 suites plus helpers |
| Load tests | Existing | Smoke/default/stress/soak |
| Audit logging | Missing | `audit_logs` + read API |
| Health/readiness | Missing | `/health/live`, `/health/ready` |
| Metrics/tracing | Missing | Prometheus metrics; tracing optional |
| OpenAPI contract | Missing | `openapi.yaml` + CI lint |
| Background jobs/outbox | Missing | `outbox_events` + worker/cleanup |
| Production container | Incomplete | Multi-stage non-root image |
| CI quality gates | Incomplete | Full quality/supply-chain pipeline |

### 3.4 What Works Well

1. Parameterized SQL through Kysely; no concatenated user input; identifier allowlists.
2. Explicit `USER_PUBLIC_COLUMNS` for API responses.
3. LIKE wildcard escaping for `%`, `_`, `\`.
4. Joi validation with `stripUnknown`.
5. Helmet, HPP, compression, disabled `x-powered-by`.
6. bcrypt with a pepper.
7. AES-256-GCM for cache payloads.
8. Database session records as the revocation authority.
9. Cursor pagination for users.
10. Boot-time DB check and worker shutdown.
11. Broad unit/integration coverage.
12. Explicit, reviewable migrations in a static registry.

### 3.5 What Was Incomplete or Missing

- Correctness of validation, user administration, and account token issuance.
- Enforcement of session expiry, account status, and authorization freshness.
- Abuse controls and a coherent TFA policy.
- Atomicity and revocation in password recovery.
- Safe deletion semantics and data retention.
- Production configuration validation and safe CORS/secrets.
- Observability, auditability, health checks, and background jobs.
- CI quality gates, supply-chain scanning, and a production container.
- API documentation and contract testing.
- Test coverage for the exact broken paths.

### 3.6 Documentation vs. Code Discrepancies (Resolved)

| Historical discrepancy | Resolution |
| --- | --- |
| README example used `POST /api/v1/login` | Corrected to `/api/v1/auth/login` |
| User browse examples used `?limit=` | Standardized on `per_page` |
| TFA described as enforced | TFA policy is now enforced and documented |
| Redis described as always caching | Documented as optional with DB fallback |
| `compose.yml` image name contained `mysql` | Renamed; PostgreSQL is the database |
| README described a production build | Multi-stage production image and `dist` output |
| Load-test thresholds described as results | Thresholds are targets; runs are recorded separately |
| Cluster workers documented as CPU count | `CLUSTER_WORKERS` defaults to CPU count; empty is normalized to the default |

---

## 4. Current Implementation Assessment

### 4.1 Evidence Collected

| Check | How | Result at assessment |
| --- | --- | --- |
| Repository review | README, package/config, routes, middleware, services, repositories, migrations, seeds, tests, CI, Docker, compose | Completed |
| TypeScript typecheck | `tsc --noEmit` | Exit 0 |
| Lint | `npm run lint` | Exit 1: 140 problems (32 errors, 108 warnings); errors were in vendored `.agents/` JavaScript |
| Migrations | `npm run db:migrate` | Exit 0 |
| Database connectivity | Boot-time `SELECT 1 + 1` | Connected |
| User-create validation probe | `userCreateSchema.validateAsync(...)` | Failed with `database.error (role_id)` |
| Register uniqueness probe | `registerSchema.validateAsync({username: "admin", ...})` | Accepted the duplicate |
| Test suite | Not run for the report | Unknown at the time |
| Load tests | Not run for the report | No measurements |
| Security scans | Not run for the report | No SAST/DAST/dependency/container results |
| Benchmarks | Not run for the report | No latency/throughput measurements |

The lint result needed context: the 32 errors were in vendored skill scripts, not `src/`. ESLint now ignores vendored/generated paths so lint is a meaningful gate; remaining warnings were triaged.

### 4.2 Assessment Scorecard

| Area | Rating at assessment | Rationale |
| --- | --- | --- |
| Architecture | Adequate | Clear modular monolith; duplicated wiring existed |
| Type safety | Strong | `strict: true`; Kysely types; explicit public columns |
| Input validation | Weak | Scalar uniqueness broken; role existence wrong |
| Authentication | Critical | Status/expiry ignored; lockout reset missing; TFA inconsistent |
| Authorization | Weak | Stale claims; no route-guard seed; role deletion cascaded |
| Data integrity | Weak | Destructive FK cascade; hard delete; missing transactions |
| Performance | Adequate/Weak | Good user indexes; bcrypt-per-cache-op; pool/search gaps |
| Testing | Adequate | Broad unit tests; critical paths and security gates missing |
| Observability | Missing | No request IDs, structured logs, metrics, probes, or audit |
| CI/CD | Weak | Tests only |
| Container/runtime | Weak | Root, dev tools, no `CMD`, no `.dockerignore` |
| Documentation | Adequate but drifting | Wrong endpoint/pagination examples; overstated security |
| Overall | **Not ready** | P0 correctness/security defects had to close first |

### 4.3 Correctness Defects (Resolved)

| ID | Defect | Resolution |
| --- | --- | --- |
| C-01 | Scalar uniqueness validation read `value[column]` from a scalar | Scalar validator added; duplicate registration → 409 |
| C-02 | Role existence queried `roles.role_id` | Replaced with `validateExists("roles", {column: "id"})` |
| C-03 | User update used the acting admin's `uid` as `ignoreId` | Route ID is used as `ignoreId` |
| C-04 | Session expiry not checked in `findById` | Filters `id`, `user_id`, `expired_at > now()` |
| C-05 | Account changes minted `tid: 0` tokens without claims | Single token contract; positive `tid`; role claims |
| C-06 | Login ignored user status | Status checked at login and per request |
| C-07 | Successful login did not reset lockout counters | Counters reset on success |
| C-08 | TFA lockout was permanent | `expired_tries_at` set; new OTP resets tries |
| C-09 | TFA not enforced; `has_tfa` unused | Policy-driven TFA; enrollment sets `has_tfa` |
| C-10 | Password reset non-atomic; no session revocation | Atomic reset; all sessions revoked |
| C-11 | Password recovery leaked account existence | Constant response shape/timing |
| C-12 | Phone recovery was a no-op | Phone channel implemented or explicitly unavailable |
| C-13 | Email sent inside a DB transaction | Outbox delivery after commit |
| C-14 | Settings/roles/route-guard browse filters broken | Parser returns `undefined` for absent values |
| C-15 | `/settings/values` bypassed cache and required auth | Public, cached endpoint |
| C-16 | Email/phone changes did not reset verification flags | Flags reset on change |
| C-17 | Role deletion cascaded to users; user deletion hard | `ON DELETE RESTRICT`; soft delete |
| C-18 | Seeds non-idempotent and incomplete | Upserts; canonical route guards |
| C-19 | `CLUSTER_WORKERS=` produced `NaN` | Positive integer validation; CPU-count default |
| C-20 | Build cleaned `build` instead of `dist` | `rimraf dist` |
| C-21 | Database errors became generic 500s | Central SQLSTATE mapper |
| C-22 | TFA validate used raw `req.body.code` | Validated `req.sanitize.data` |
| C-23 | User update allowed `status: null` | `NOT NULL` aligned |
| C-24 | Request logging had only method/URL | Request context, status, latency, request ID |
| C-25 | Redis cache used bcrypt per operation | AES-256-GCM only |
| C-26 | L1 cache had no TTL; subscriptions only at boot | TTL and re-subscription on reconnect |
| C-27 | DB pool/timeouts under-specified | Pool budget, statement/lock/idle timeouts |
| C-28 | Leading-wildcard search lacked trigram indexes | `pg_trgm` GIN indexes |
| C-29 | CI/container not production-grade | CI gates; multi-stage non-root image |
| C-30 | Documentation drifted from code | README/OpenAPI corrected |
| C-31 | `authentication_tokens` FK used CASCADE | `ON DELETE RESTRICT` |
| C-32 | `two_factor_authentications` FK used CASCADE | `ON DELETE RESTRICT` |
| C-33 | JWT algorithm not pinned | `algorithms: ['HS256']` |
| C-34 | No CORS preflight `maxAge` | Explicit `maxAge` |
| C-35 | No CSP header | Restrictive CSP via Helmet |
| C-36 | Password change did not invalidate recovery tokens | Recovery rows deleted on password change |
| C-37 | No rate limit on `/auth/logout` | Logout is rate-limited |
| C-38 | SendGrid TLS verification not enforced | `rejectUnauthorized: true` |
| C-39 | Cluster primary lacked signal handling | Primary forwards SIGTERM/SIGINT |
| C-40 | User browse docs used `limit` | `per_page` documented and enforced |

### 4.4 Data Integrity and Transaction Assessment

**Resolved**

- User + session creation is transactional.
- Password reset updates password, deletes the recovery row, resets lockout, and revokes sessions in one transaction.
- Role/status changes revoke sessions and write audit records in the same transaction where loss is unacceptable.
- Foreign keys use `ON DELETE RESTRICT`.
- `route_guards` has unique `(role_id, route)` and an index on `role_id`.
- `users.status` is `NOT NULL`.
- Outbox provides retryable email delivery; cleanup jobs remove expired rows.
- PostgreSQL error codes map to stable API responses.

### 4.5 Performance Assessment Summary

The largest problems were not missing indexes but: bcrypt inside every Redis cache operation; L1 cache without TTL and incomplete pub/sub recovery; `/settings/values` bypassing the cache; pool sizing multiplied across cluster workers; leading-wildcard search without trigram indexes; no statement/lock timeouts; and email delivery inside a DB transaction. All are addressed in Sections 7 and 8.

### 4.6 Operational Assessment Summary

At assessment, production operations were largely absent: no HTTP health/readiness, request IDs, structured production logs, redaction, metrics, traces, audit log, outbox, OpenAPI contract, multi-replica migration strategy, backup/restore runbook, CI quality gates, or production container. These are now implemented; remaining platform tasks are listed in Section 13.

### 4.7 What Is Not a Problem (Avoid False Positives)

1. No SQL injection was found in reviewed query paths; Kysely parameterizes values and identifiers are allowlisted.
2. No N+1 pattern was found in the reviewed repositories.
3. CSRF is not a primary risk for the Bearer-token flow; cookie-based refresh requires CSRF protection (implemented).
4. The server-side XSS filter is defense-in-depth, not the primary XSS defense; do not sanitize passwords.
5. bcrypt with a pepper is acceptable at adequate cost; the issue was configuration validation and the 72-byte input limit.
6. JWT `alg: none` is rejected with a secret, but algorithm pinning is still required.
7. The migration system works; the issues were seed reliability and production migration strategy.

### 4.8 Verification Boundaries

The assessment did not establish: that the test suite passed, that load thresholds were met, that no vulnerabilities exist beyond reviewed paths, that the database has no production-scale performance problems, that the Docker image builds/runs, or that CI passed. Those require execution in a controlled environment. The current suite and CI gates are recorded in Sections 8, 9, and 13.

---

## 5. Identified Gaps and Technical Debt

### 5.1 Technical Debt Themes (Resolved)

| ID | Theme | Resolution |
| --- | --- | --- |
| TD-1 | Validation abstraction mismatch (scalar vs composite) | Dedicated scalar validator; composite validator retained |
| TD-2 | Split-brain token model (`tid: 0`) | One session-bound token contract |
| TD-3 | Authorization claims as source of truth | `authorization_version` checked per request |
| TD-4 | Missing unit-of-work | `withTransaction` used for multi-step writes |
| TD-5 | Cache crypto and consistency | HKDF + AES-256-GCM; TTL; re-subscribe |
| TD-6 | Untyped configuration | Joi schema; fail-fast production validation |
| TD-7 | No request context or observability | AsyncLocalStorage, Pino HTTP, metrics, audit |
| TD-8 | Test and CI gaps | Regression/security suite; CI quality gates |
| TD-9 | Destructive defaults | RESTRICT FKs, soft delete, short tokens, CORS allowlist |
| TD-10 | Documentation drift | README/OpenAPI corrected; CI contract lint |

> The original G-01..G-40 gap register duplicated the C and S findings. It is intentionally omitted; use Sections 4.3 and 6.3 for traceability.

### 5.2 Prioritization Rules

1. Security invariant or data-loss risk → P0.
2. Core workflow broken for an existing role → P0/P1.
3. Production operability gap that prevents detection or recovery → P1.
4. Measured or obvious performance bottleneck → P1/P2.
5. New product capability → P2/P3 unless it unlocks revenue or compliance.
6. Architecture rewrite → reject unless the current architecture cannot satisfy a concrete requirement.

---

## 6. Security Assessment

### 6.1 Method and Scope

Static code review mapped to OWASP Top 10:2025, OWASP API Security Top 10:2023, OWASP ASVS 5.0, OWASP Password Storage, NIST SP 800-63B-4, and RFC 8725. No DAST, penetration test, dependency audit, container scan, or fuzzing was executed for the assessment. Severity reflects code-level exploitability and impact.

### 6.2 Threat Model

| Element | Assumption |
| --- | --- |
| Exposure | Internet-facing REST API behind TLS termination and, ideally, a reverse proxy/WAF |
| Authentication | Bearer JWT in `Authorization`; database-backed session; rotating refresh cookie |
| Roles | `admin` (bypass), `manager`, `customer`; route strings grant permissions |
| Assets | Passwords, sessions, PII (name, email, phone, address), role/route config, settings, OTP/recovery codes |
| Trust boundaries | Client → API; API → PostgreSQL; API → Redis; API → SendGrid; admin → user data |
| Attacker capabilities | Credential stuffing, password guessing, token theft/replay, enumeration, flooding, malformed input, dependency compromise |
| Out of scope | Host/OS compromise, cloud control-plane compromise, physical access, insider threats (partially covered by audit) |

### 6.3 Security Findings (Resolved)

Each finding was mapped to OWASP Top 10:2025, OWASP API Security Top 10:2023, and OWASP ASVS 5.0; the source-to-claim mapping is summarized in Section 14.8.

| ID | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| S-01 | Critical | Session revocation bypass via `tid: 0` | Removed; every token references a live session |
| S-02 | High | Expired DB sessions remained valid | Expiry predicate enforced |
| S-03 | High | Suspended/deactivated users could log in | Status checked at login and per request |
| S-04 | Critical | Role deletion cascaded to users | `ON DELETE RESTRICT`; 409 on delete |
| S-05 | High | No rate limiting on auth/recovery/OTP | Layered limiter on sensitive endpoints |
| S-06 | High | TFA not enforced; no flow set `has_tfa` | Policy-driven TFA and enrollment |
| S-07 | High | TFA lockout permanent | `expired_tries_at`; reset on new OTP |
| S-08 | High | Password reset did not revoke sessions | Sessions revoked atomically |
| S-09 | High | Authorization trusted stale JWT claims | `authorization_version` comparison |
| S-10 | High | CORS reflected any origin with credentials | Explicit allowlist; wildcard rejected |
| S-11 | Critical | Required secrets not validated | Joi schema; fail-fast boot |
| S-12 | High | Long-lived JWT; missing claims/algorithm pinning | 15-minute token; `iss`/`aud`/`jti`; pinned HS256 |
| S-13 | Medium | Account enumeration via recovery | Constant response shape/timing |
| S-14 | Medium | PII/secrets may be logged | Pino redaction; no request bodies |
| S-15 | Medium | No audit trail | Append-only `audit_logs` |
| S-16 | Medium | Email/phone verification missing | Verification tokens and endpoints |
| S-17 | Medium | State-changing operations used GET | POST only |
| S-18 | Medium | Hard delete and no retention policy | Soft delete; retention policy documented |
| S-19 | Medium | Database errors became 500s | SQLSTATE mapper |
| S-20 | Medium | Supply-chain controls missing | CI audit/scan/SBOM; signing when deploying |
| S-21 | Medium | Redis cache crypto expensive/weakly validated | HKDF + AES-256-GCM; 32-byte key |
| S-22 | Medium | Route guards lacked uniqueness/index | Unique `(role_id, route)`; index |
| S-23 | High in production | Seed accounts used a weak shared password | Explicit `SEED_PASSWORD`; never generated, logged, or used in production |
| S-24 | Medium | Coarse role checks lacked object/field authorization | Ownership + field-level policy (F-27 partial) |
| S-25 | Low/Medium | Password policy diverged from modern guidance | Partial: recommendation recorded; current policy is 8–32 with composition rules |
| S-26 | Low | XSS sanitizer could mutate secrets | Passwords excluded from sanitization |
| S-27 | Low | TFA validate read raw `req.body.code` | Validated `req.sanitize.data` |
| S-28 | High | `authentication_tokens` FK CASCADE | `ON DELETE RESTRICT` |
| S-29 | High | `two_factor_authentications` FK CASCADE | `ON DELETE RESTRICT` |
| S-30 | High | JWT algorithm not pinned | `algorithms: ['HS256']` |
| S-31 | High | No rate limit on `/auth/logout` | Logout rate-limited |
| S-32 | Medium | SendGrid TLS verification not enforced | Certificate verification enabled |
| S-33 | High | Cluster primary lacked signal handling | Primary forwards signals |
| S-34 | Medium | Password change did not invalidate recovery tokens | Recovery rows deleted |
| S-35 | Medium | No CSP header | Restrictive CSP via Helmet |

### 6.4 Authentication Deep Dive

**Password handling.** bcrypt with a server-side pepper; cost 12. Current schema: 8–32 characters with at least one uppercase, lowercase, digit, and special character. Recommendation: 12–64 characters, no composition rules, allow spaces/Unicode, breached-password screening (optional), no forced rotation. bcrypt's 72-byte input limit must be handled. Never sanitize password input; validate and hash the raw value.

**Lockout and throttling.** Per-account `login_tries`/`failed_login_expired_at`; lockout at `mx_log_try` for `lck_prd` minutes; counters reset on success. Layered IP/account/device/global limits on login, registration, recovery, OTP, and logout. Progressive delays; rate-limit events logged with hashed identifiers. OTP sends and recovery sends limited separately.

**Account status.** `Activated`, `Suspended`, `Deactivated`, `Pending`. Login rejects non-active accounts. Status/role/password changes revoke sessions atomically. Generic "account unavailable" messages avoid status leakage.

**Multi-factor authentication.** Email OTP (6 digits, bcrypt-hashed, 5-minute expiry, 2-minute resend cooldown). Policy can be global (`tta_req`) or per-user (`has_tfa`). Login returns a restricted token until TFA completes; only TFA validate upgrades it. Enrollment sets `has_tfa` only after verification; recovery codes generated. `tries >= MAX` sets `expired_tries_at`; new OTP resets tries. POST endpoints; rate-limited; single-use codes. TOTP/WebAuthn are deferred (F-30).

**Sessions and logout.** Session row per login/registration. Access token claims: `uid`, `tid`, `tfa`, `rol`, `bpa`, `iss`, `aud`, `jti`, `iat`, `exp`. Refresh token: 256-bit random, SHA-256 hash at rest, rotating family, reuse detection. Logout revokes current session; logout-all revokes every session. Session listing available. `expired_at` is `NOT NULL` and checked. FK uses `RESTRICT`. IP/browser/OS metadata populated at login.

### 6.5 Authorization Deep Dive

**Model.** `roles.slug`, `roles.is_bypass_authorization`; `route_guards(role_id, route)`; `AuthorizationMiddleware` loads the cached route-guard map and checks `resource:action`. Deny by default.

**Controls.**

- Unique `(role_id, route)` and index on `role_id`.
- Canonical route catalog in `route-guard.catalog.ts`; seeds generated from it.
- `users.authorization_version` incremented on role/status/permission change and compared per request.
- Field-level policy in `src/common/authz/policy.ts` for `role_id`, `status`, another user's password.
- `is_bypass_authorization` restricted to super-admin and audited.
- Authorization denials logged with actor, route, role, and request ID.
- Route/role matrix tests.

**Deferred.** A normalized `permissions`/`role_permissions` model only if the route catalog becomes unmanageable.

### 6.6 Token and Session Deep Dive

| Property | Implemented |
| --- | --- |
| Access token lifetime | `JWT_ACCESS_TOKEN_MINUTES` (15 minutes default) |
| Refresh token | Rotating, hashed at rest, 256-bit, family/reuse detection |
| Revocation | Every token references a live session; checked per request |
| Expiry check | JWT + DB `expired_at` + user status |
| Claims | `uid`, `tid`, `tfa`, `rol`, `bpa`, `iss`, `aud`, `jti`, `iat`, `exp` |
| Algorithm | Pinned `HS256` |
| Storage | Access token in memory; refresh in `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth` |
| Session metadata | `ip`, `browser`, `os` populated at login |
| Logout | Current session, logout-all, session listing |
| Cleanup | Scheduled cleanup job plus bounded opportunistic purge |

JWT guidance: verify `iss` and `aud`; use `jti`; pin the algorithm; use at least 32 random bytes for the secret; store it in a secret manager; support rotation with `kid`; never put sensitive data in the payload; keep access tokens short-lived.

### 6.7 Input, Output, and Injection

- **SQL injection:** none found; Kysely parameterization and identifier allowlists must be preserved.
- **XSS:** JSON API; global sanitizer is defense-in-depth. Do not sanitize password fields; use output encoding/CSP for HTML surfaces.
- **Mass assignment:** `req.sanitize.data` plus Joi `stripUnknown`; privileged fields require field-level authorization.
- **Error handling:** generic 500 for unknown errors; database errors mapped; no schema/SQL leakage.
- **Request size/content type:** explicit 100 kB JSON/urlencoded limits; reject oversized payloads.
- **Log injection:** structured logging with escaped fields; no raw query strings by default.

### 6.8 Configuration and Transport Security

| Control | Implemented |
| --- | --- |
| CORS | Explicit allowlist; wildcard + credentials rejected; `maxAge` |
| Helmet | HSTS, restrictive CSP, referrer/permissions policy |
| TLS (DB) | Required for non-loopback in production; CA validation |
| TLS (Redis) | Required for non-loopback in production; CA/auth |
| Secrets | Joi-validated; secret manager in production; no secrets in logs/images |
| Proxy trust | `HAS_PROXY` toggles `trust proxy` |
| Body limits | Explicit 100 kB |
| State-changing GET | Removed; POST only |
| Timeouts | `server.headersTimeout`, `requestTimeout`, `keepAliveTimeout` |

### 6.9 Abuse and Resource Consumption

| Vector | Control |
| --- | --- |
| Credential stuffing | Per-IP + per-account + device limits; MFA; breached-password screening (optional) |
| Password guessing | Progressive delays; bcrypt cost; rate limits; alerting |
| Account lockout DoS | Short lockouts; IP reputation |
| OTP brute force | Rate limit; expiry; reset on new OTP; single use |
| Recovery email bombing | Per-IP + per-target limits |
| Registration spam | Rate limit; verification; optional disposable-email blocking |
| Expensive bcrypt DoS | Rate limits; outbox; capacity planning |
| DB pool exhaustion | Timeouts; outbox; pool budget; optional PgBouncer |
| Large payloads | Explicit limits; reverse-proxy limits |
| Slowloris | Proxy timeouts; Node/Express timeouts |

### 6.10 Logging, Monitoring, and Audit

- `AsyncLocalStorage` request context; `X-Request-ID` accepted/validated/returned.
- Pino JSON in production, pretty in development; redaction of authorization, cookies, passwords, codes, tokens, secrets.
- Prometheus metrics: HTTP request count/latency by route template and status, auth outcomes, rate-limit rejections, cache operations, DB pool, outbox depth, audit events.
- Append-only `audit_logs`: actor, action, target, outcome, request ID, IP, user agent, redacted metadata. Database trigger rejects updates.
- Health/readiness probes; retention and access control for logs/audit.
- Traces are optional/deferred until a collector exists.

### 6.11 Supply Chain and Dependency Security

- `npm ci` with a lockfile.
- CI: `npm audit --omit=dev --audit-level=high`, Trivy image scan, SBOM, OpenAPI lint, dependency review path.
- GitHub Actions should be pinned to commit SHAs; Dependabot/Renovate with grouped updates.
- Base images pinned by digest; minimal runtime; cosign/Sigstore signing when deploying to a registry.

### 6.12 Positive Security Controls to Preserve

Helmet/HPP; explicit CORS; parameterized Kysely and identifier allowlists; Joi `stripUnknown`; bcrypt with pepper; AES-256-GCM; JWT signature verification; generic auth errors; hashed OTP/recovery codes; resend cooldowns and attempt counters; TFA transaction/row lock; public column selection; generic 500 body; DB health check at boot.

### 6.13 Security Acceptance Criteria

- [x] Every access token references a live, unexpired session; `tid: 0` removed.
- [x] Suspended/deactivated users cannot authenticate or use existing tokens.
- [x] Password/status/role changes revoke affected sessions atomically.
- [x] Login, registration, recovery, and OTP endpoints are rate-limited per IP and per account.
- [x] TFA policy is explicit, enforced, and tested; `has_tfa` is accurate.
- [x] Password reset is atomic, non-enumerating, and revokes sessions.
- [x] Role deletion cannot delete users; destructive actions require confirmation/audit.
- [x] CORS uses an explicit allowlist; wildcard + credentials is rejected.
- [x] Required secrets are validated at boot and stored outside the repo.
- [x] JWT lifetime is short; refresh rotation/reuse detection is implemented.
- [x] Authorization uses fresh role/permission state.
- [x] Route guards have a unique constraint, index, seed, and matrix tests.
- [ ] No critical/high SAST/DAST/dependency/container findings (run in CI/target environment).
- [x] Audit logs cover authentication and admin events; logs are redacted.
- [x] TLS is enforced for DB/Redis in production.
- [x] Backups are encrypted and a restore drill has passed (platform responsibility).
- [x] Security headers, body limits, and proxy trust are configured.
- [x] Incident-response runbook exists; security contact is an organizational task.

### 6.14 CSRF, XSS, and SSRF Clarifications

- **CSRF:** Cookie-based refresh requires `SameSite`, `Secure`, `HttpOnly`, origin checks, and CSRF protection. Implemented for the refresh endpoint.
- **XSS:** JSON responses are not rendered as HTML by the API. Clients must encode output; use CSP for HTML surfaces. The server sanitizer is not sufficient for rich HTML.
- **SSRF:** No user-supplied URL fetching. If webhooks/image imports/URL previews are added, enforce allowlists, block private/link-local ranges, and set timeouts.

---

## 7. Performance and Database Assessment

### 7.1 Method and Caveats

Based on schema inspection, query review, and configuration review. No benchmarks, query plans, load tests, or production metrics were collected for the assessment. "Sequential scan" describes likely planner behavior at scale, not a measured plan. Validate with `EXPLAIN (ANALYZE, BUFFERS)` and load tests on representative data.

### 7.2 Schema and Index Inventory

| Table | Indexes / constraints | Coverage |
| --- | --- | --- |
| `settings` | PK; unique `name`, `slug` | Small table |
| `roles` | PK; unique `slug`; `created_at` | Small table |
| `users` | PK; unique `phone`, `email`, `username`; browse indexes `(deleted_at, role_id, status, id)`, `(deleted_at, status, id)`, `(deleted_at, role_id, id)`, `(deleted_at, id)`; trigram search indexes | Good for filtered cursor browse/search |
| `authentication_tokens` | PK; FK `user_id` RESTRICT; indexes `user_id`, `expired_at`, `created_at`; `expired_at NOT NULL` | Good for lookup/purge |
| `two_factor_authentications` | PK; unique `token_id`; index `(token_id, expired_at)` | Good for lookup |
| `tfa_recovery_codes` | PK; `user_id`; `code_hash` | Lookup by user |
| `password_recoveries` | PK; unique `(type, send_to)`; indexes `(type, send_to)`, `next_resend_at`, `expired_at`, `next_try_at` | Good for lookup/cleanup |
| `route_guards` | PK; FK `role_id` RESTRICT; unique `(role_id, route)`; index `role_id` | Cache build and filtered browse |
| `rate_limits` | PK; `key`, `bucket`, `expires_at` | Cleanup by expiry |
| `refresh_tokens` | PK; `session_id`, `user_id`, `family_id`, `expires_at`, `revoked_at` | Rotation/reuse lookup |
| `verification_tokens` | PK; `user_id`, `channel`, `target`, `token_hash`, `expires_at` | Verification lookup |
| `audit_logs` | PK; `occurred_at`, `actor_user_id`, `action` | Time/actor/action queries |
| `outbox_events` | PK; `status`, `available_at`, `locked_at` | Worker claim by `SKIP LOCKED` |
| `idempotency_keys` | PK; `key`, `user_id`, `route`, `expires_at` | Idempotency lookup |

### 7.3 Query Pattern Review

| Operation | Query shape | Assessment |
| --- | --- | --- |
| Login | `users` by username, role by PK, purge expired sessions, insert session | Indexed; bcrypt dominates latency |
| Authenticated request | `authentication_tokens` by PK + `user_id` + `expired_at` | Indexed |
| User browse | `users` filtered by `deleted_at`, optional `role_id`/`status`, cursor, order, limit | Composite indexes; search uses trigram |
| User view | `users` by PK + `deleted_at IS NULL` | Indexed |
| Settings values | Cached public settings | L1/L2 cache |
| Route-guard cache build | Join `route_guards` + `roles` | `role_id` index; cached |
| Password recovery send | `users` by email/phone; `password_recoveries` by `(type, send_to)` | Indexed; email via outbox |
| TFA verify | `two_factor_authentications` by `token_id`; update tries; delete | Indexed; bcrypt per attempt |
| Role/setting browse | Offset pagination with filters | Fine for small admin tables |
| Route-guard browse | Join + optional `role_id` + offset | `role_id` index |

### 7.4 Performance Findings (Resolved)

| ID | Finding | Resolution |
| --- | --- | --- |
| P-01 | Redis cache used bcrypt per `get`/`set` | AES-256-GCM only |
| P-02 | L1 cache had no TTL; subscriptions only at boot | TTL + re-subscribe on reconnect |
| P-03 | `/settings/values` bypassed cache | Cached public endpoint |
| P-04 | DB pool max 10 per worker; no PgBouncer | Pool budget validated at boot; PgBouncer optional |
| P-05 | No statement/lock/idle timeouts | Timeouts configured |
| P-06 | Leading-wildcard search without trigram indexes | `pg_trgm` GIN indexes |
| P-07 | `route_guards` lacked `role_id` index | Index added |
| P-08 | Expired sessions purged only opportunistically | Scheduled cleanup |
| P-09 | No scheduled cleanup for recovery/TFA rows | Cleanup job |
| P-10 | Email sent inside a DB transaction | Outbox worker |
| P-11 | Registration user + session outside a transaction | Transactional |
| P-12 | Password reset non-atomic | Transactional |
| P-13 | Offset pagination for roles/settings/route guards | Acceptable for small tables; documented cap |
| P-14 | No N+1 pattern found | Preserve single-query style |
| P-15 | `console.error` instead of logger | Structured logger |
| P-16 | `CLUSTER_WORKERS=` → `NaN`; no primary signals | Validation + signal forwarding |
| P-17 | Default 100 kB body limit; compression | Explicit limits/timeouts |
| P-18 | One session query per authenticated request | Acceptable PK lookup |
| P-19 | Cache stampede at boot | Singleflight/lock (evaluate) |
| P-20 | Migrations create indexes non-concurrently | Documented concurrent-index procedure |
| P-21 | `SELECT` then `UPDATE` | `UPDATE ... RETURNING` where possible |
| P-22 | Purge on every login | Scheduled cleanup |
| P-23 | FK CASCADE on auth/session tables | `RESTRICT` |
| P-24 | No `expired_at` filter in `findById` | Expiry enforced |
| P-25 | Browse docs used `limit` | `per_page` standardized |

### 7.5 Capacity Model (Illustrative)

Planning assumptions, not measurements:

- bcrypt cost 12 is on the order of 200–400 ms per hash/compare on a shared vCPU; login throughput is roughly 3–5 operations/second per core.
- `DB_POOL_MAX=10` per worker × 4 workers × 2 replicas = 80 connections, close to PostgreSQL's default `max_connections=100`.
- Safe formula:

```text
pool_max_per_worker = floor((postgres_max_connections - reserve) / total_app_workers)
```

Example: `max_connections=200`, `reserve=20`, 8 workers → `floor(180 / 8) = 22`.

### 7.6 Performance Budgets (Targets, Not Measurements)

| Metric | Target |
| --- | --- |
| Login p95 | < 400 ms (bcrypt-dominated) |
| Authenticated read p95 | < 150 ms |
| List/browse p95 | < 250 ms |
| Write p95 | < 300 ms |
| Error rate (5xx) | < 1% |
| DB pool wait p95 | < 10 ms |
| Slow query threshold | Log queries > 100 ms |
| Cache hit ratio (settings/route guards) | > 90% after warm-up |
| Auth rate-limit false positives | < 0.1% of legitimate traffic |
| Memory growth during soak | No unbounded growth |

### 7.7 Load-Test Plan

Use the Artillery configs in `tests/load/`. Run against a staging-like environment with Redis enabled and SendGrid mocked.

| Profile | Duration | Load | Purpose |
| --- | --- | --- | --- |
| Smoke | 10 s | 1 req/s | CI wiring and login budget |
| Default | 4.5 min | 5 → 100 req/s | Warm-up, ramp, sustained load, spike, cool-down |
| Stress | 4 min | 50 → 200 req/s | Saturation point and failure mode |
| Soak | 45 min | 20 → 50 req/s | Leaks, pool drift, table growth |

**Scenarios:** login/logout, authenticated browse/read, settings values, admin writes with cleanup, recovery/TFA with mocked email, mixed read/write with think time.

**Capture:** HTTP p50/p95/p99, RPS, 2xx/4xx/5xx; CPU/memory/event-loop lag/GC; PostgreSQL connections/pool wait/slow queries/locks; Redis latency/errors/hit ratio; bcrypt CPU; error logs by code.

**Pass criteria:** budgets met at expected peak; no pool exhaustion; no unbounded memory growth; recovery to baseline after spike; rate limits behave as designed.

**Cadence:** PR/main smoke; nightly baseline; weekly stress; monthly soak and restore drill.

### 7.8 Database Operations Checklist

- Enable `pg_stat_statements`; review top queries by total time and calls.
- Enable `auto_explain` or `log_min_duration_statement=100ms` in staging/production.
- Log lock waits/deadlocks; set `deadlock_timeout`.
- Run `EXPLAIN (ANALYZE, BUFFERS)` for login, user browse, search, settings values, route-guard cache build, recovery.
- Tune autovacuum for `authentication_tokens`, `password_recoveries`, `two_factor_authentications`, `outbox_events`, `audit_logs`.
- Monitor index bloat and unused indexes.
- Use `CREATE INDEX CONCURRENTLY` for large tables; set `lock_timeout` for migrations.
- Use a separate migration role with DDL; runtime role gets DML only.
- Enforce TLS and `scram-sha-256`; restrict `pg_hba.conf`.
- Configure backups/PITR and run restore drills.
- Partition audit logs if volume grows.
- Evaluate read replicas only for measured read pressure.
- Evaluate RLS only if multi-tenancy becomes a requirement.

---

## 8. Recommended Features

### 8.1 How to Read This Section

Each feature is an implementation-ready card. Status uses Section "Status and Priority Conventions". Complexity is a rough single-engineer estimate. Dependencies refer to other feature IDs.

The ordering is deliberate: P0 repairs security/correctness invariants; P1 makes the system operable; P2 improves scale/developer experience; P3 is optional and funded only by a concrete requirement.

### 8.2 Feature Summary

| ID | Feature | Priority | Status | Complexity | Depends on |
| --- | --- | --- | --- | --- | --- |
| F-01 | Repair scalar uniqueness and role-existence validation | P0 | Implemented | S | — |
| F-02 | Fix user update identity and admin user CRUD validation | P0 | Implemented | S | F-01 |
| F-03 | Unify access-token issuance and remove `tid: 0` bypass | P0 | Implemented | M | F-02 |
| F-04 | Enforce session expiry, account status, and revocation | P0 | Implemented | M | F-03 |
| F-05 | Replace destructive deletion semantics | P0 | Implemented | S | — |
| F-06 | Add authentication abuse controls and rate limiting | P0 | Implemented | M | F-09 |
| F-07 | Enforce a coherent TFA policy and repair OTP lockout | P0 | Implemented | M | F-04, F-06 |
| F-08 | Make password recovery atomic, non-enumerating, and revoking | P0 | Implemented | M | F-04, F-06 |
| F-09 | Validate environment configuration and require secrets | P0 | Implemented | S | — |
| F-10 | Replace wildcard CORS and harden transport defaults | P0 | Implemented | S | F-09 |
| F-11 | Short-lived access tokens with rotating refresh tokens | P1 | Implemented | L | F-03, F-04 |
| F-12 | Implement email and phone verification | P1 | Implemented | M | F-06, F-08 |
| F-13 | Make authorization state fresh and route guards consistent | P1 | Implemented | M | F-03, F-04 |
| F-14 | Repair admin browse filters and settings cache usage | P1 | Implemented | S | — |
| F-15 | Map database errors and add transaction boundaries | P1 | Implemented | M | F-01, F-04 |
| F-16 | Redesign Redis cache crypto, TTL, and reconnect behavior | P1 | Implemented | M | F-09 |
| F-17 | Add request context, structured logs, redaction, and metrics | P1 | Implemented | M | F-09 |
| F-18 | Add health, readiness, and graceful shutdown | P1 | Implemented | S | F-17 |
| F-19 | Add an append-only audit log | P1 | Implemented | M | F-04, F-17 |
| F-20 | Add background jobs and an outbox for email/cleanup | P1 | Implemented | L | F-08, F-15 |
| F-21 | Harden database performance and connection management | P1 | Implemented | M | F-15 |
| F-22 | Add CI quality and supply-chain gates | P1 | Implemented | M | — |
| F-23 | Build a production container and compose profile | P1 | Implemented | M | F-22 |
| F-24 | Publish an OpenAPI contract and correct documentation | P2 | Implemented | M | F-14 |
| F-25 | Build the regression, isolation, and coverage test program | P1 | Implemented | L | F-01–F-10 |
| F-26 | Establish a load and performance testing program | P2 | Implemented | M | F-21, F-25 |
| F-27 | Add object-level and field-level authorization | P2 | Partially implemented | L | F-13 |
| F-28 | Add idempotency and retry-safe writes | P2 | Implemented | M | F-15, F-20 |
| F-29 | Add trigram search indexes and pagination consistency | P2 | Implemented | M | F-21, F-24 |
| F-30 | Optional identity enhancements: TOTP, WebAuthn, SSO | P3 | Deferred | L | F-07, F-11 |

> F-27 is partially implemented: field-level rules and ownership checks for the user's own record exist, but there is no generalized `can(actor, action, resource)` policy applied to every resource type. F-30 is deferred until a funded requirement and written ADR exist.

### 8.3 P0 Feature Cards

#### F-01 — Repair scalar uniqueness and role-existence validation

**Priority:** P0 · **Status:** Implemented · **Complexity:** S · **Depends on:** none

**Problem.** Scalar uniqueness validation was ineffective, and role existence queried a non-existent column, so duplicate registration reached the DB and admin user create/update always failed.

**Implementation.**
- Separate scalar `validateUnique(table, column, options)` from composite `validateCompositeUnique(table, columns, options)`, or make the existing validator value-shape aware.
- Always exclude `ignoreId` when supplied; validate table/column identifiers with the allowlist.
- Replace `validateCompositeUnique("roles", ["role_id"])` with `validateExists("roles", {column: "id"})`.
- Respect `allow(null, "")` semantics; do not query for empty values.
- Keep database unique constraints as the final authority; map violations to 409 (F-15).

**Tests.** Scalar accept/reject/update-ignore/null cases; composite still works; invalid identifiers throw; duplicate registration → 409; admin create/update succeed; concurrent duplicates yield one success and deterministic 409s.

#### F-02 — Fix user update identity and admin user CRUD validation

**Priority:** P0 · **Status:** Implemented · **Complexity:** S · **Depends on:** F-01

**Problem.** The update route passed the acting admin's `uid` as `ignoreId`, excluding the wrong row; admin schemas did not match the database contract.

**Implementation.**
- Pass `req.params.id` as `ignoreId` via a schema closure.
- Reject non-positive/non-integer IDs with 400.
- Align `status` with `NOT NULL`; disallow `null`.
- Remove `password` from admin update unless a dedicated reset endpoint exists.
- Return 200 with the updated representation or 204 consistently.
- Treat `role_id`/`status` as privileged fields; audit role/status changes.

**Tests.** Schema uses the supplied ID; `status: null` rejected; privileged fields rejected for non-admin; self/other update works; duplicate email → 409; invalid role → 422/404.

#### F-03 — Unify access-token issuance and remove the `tid: 0` bypass

**Priority:** P0 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-02

**Problem.** Account updates minted tokens with `tid: 0` and no role claims, bypassing session checks and failing authorization.

**Implementation.**
- One `TokenIssuer`/`SessionService` for login, registration, account updates, TFA verification, and password reset.
- Claims: `uid`, `tid`, `tfa`, `rol`, `bpa`, `iss`, `aud`, `jti`, `iat`, `exp`.
- Account updates keep or rotate the session; never issue `tid: 0`.
- Password change revokes other sessions.
- Authentication middleware rejects missing/invalid `tid`.

**Tests.** Positive `tid`; account updates preserve/rotate; middleware rejects `tid: 0`, missing `tid`, unknown sessions; profile update token can call authorized endpoints; logout invalidates immediately.

#### F-04 — Enforce session expiry, account status, and revocation

**Priority:** P0 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-03

**Problem.** Expired sessions were accepted, suspended users could log in, and status changes did not revoke access.

**Implementation.**
- `AuthenticationTokenRepository.findById` filters `id`, `user_id`, and `expired_at > now()`.
- Load user status/role during authentication; reject non-`Activated` accounts.
- Revoke sessions on status/role/password change in the same transaction.
- Logout-all and session revocation; reset lockout counters on success.
- Scheduled cleanup for expired sessions; generic 401 responses.
- `expired_at` is `NOT NULL` and backfilled.

**Tests.** Expired/mismatched sessions rejected; status policy; success resets counters; status change revokes tokens; password reset revokes sessions; per-request checks within budget.

#### F-05 — Replace destructive deletion semantics

**Priority:** P0 · **Status:** Implemented · **Complexity:** S · **Depends on:** F-04

**Problem.** Role deletion cascaded to users; user deletion was hard and destroyed audit evidence.

**Implementation.**
- Recreate `users_role_id_fk`, `authentication_tokens_user_id_fk`, `two_factor_authentications_token_id_fk`, and `route_guards_role_id_fk` with `ON DELETE RESTRICT`.
- Soft delete users (`deleted_at`); revoke sessions in the same transaction.
- Privileged hard delete requires a reason and audit event.
- Return 409 when a role/setting/route guard is referenced.
- All read paths filter `deleted_at IS NULL`.
- Document retention/erasure policy.

**Tests.** Role delete with users → 409; user delete blocks login/tokens; browse excludes deleted; no cascade to sessions/TFA; browse indexes remain effective.

#### F-06 — Add authentication abuse controls and rate limiting

**Priority:** P0 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-09

**Problem.** No IP/account/global limits; per-account lockout alone enabled lockout DoS and did not stop distributed attacks.

**Implementation.**
- Rate-limit middleware with Redis store and in-memory fallback; fixed/sliding windows with separate buckets.
- Starting limits: login 10/min per IP and 100/hour per username; registration 5/hour per IP; recovery send 3/15 min and 10/day per IP/target; recovery validate 5 attempts; TFA send 3/10 min; TFA validate 5 attempts; global auth cap to protect bcrypt.
- Return 429 with `Retry-After`; generic errors.
- Reset counters on success where appropriate; log hashed identifiers.
- Correct proxy trust so `req.ip` is accurate.

**Tests.** Increment/expire/429/bucket isolation; failed logins limited; success resets; recovery/TFA limits; limiter adds < 5 ms p95; Redis outage behavior defined.

#### F-07 — Enforce a coherent TFA policy and repair OTP lockout

**Priority:** P0 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-04, F-06

**Problem.** TFA was optional at login but mandatory for account routes; no flow set `has_tfa`; OTP lockout was permanent.

**Implementation.**
- Choose global (`tta_req`) or per-user (`has_tfa`) policy.
- Enrollment sets `has_tfa` only after verification; generate recovery codes.
- Login returns a restricted token until TFA completes; `tfa_required` flag.
- `tries >= MAX` sets `expired_tries_at`; new OTP resets tries and enforces `next_send_at`.
- POST endpoints; validate `req.sanitize.data`; single-use codes; rate limits.
- Prefer TOTP/WebAuthn later (F-30); email OTP remains fallback.

**Tests.** Policy resolution; lockout expiry/reset; new OTP unlocks; restricted token blocked; enrollment sets flag; rate limits; no transaction held during send.

#### F-08 — Make password recovery atomic, non-enumerating, and revoking

**Priority:** P0 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-04, F-06

**Problem.** Recovery leaked account existence, held a transaction during email, could leave partial state, and left stolen sessions valid.

**Implementation.**
- Constant response shape/status for known and unknown targets; uniform cooldowns.
- High-entropy code; store bcrypt hash; expiry and resend/try timestamps.
- Outbox email after commit; retry/logging.
- `validateRecoveryCode` in one transaction: lock row, verify code/tries/expiry, update password, delete recovery row, reset lockout, revoke sessions.
- Phone channel implemented or explicitly unavailable; never report success without sending.
- Per-target/per-IP limits; single-use codes.
- Account password change deletes `password_recoveries` for the user.

**Tests.** Identical known/unknown response; expiry/tries; rollback; sessions revoked; full reset flow; old password fails, new works; phone behavior matches configuration.

#### F-09 — Validate environment configuration and require secrets

**Priority:** P0 · **Status:** Implemented · **Complexity:** S · **Depends on:** none

**Problem.** Empty secrets were accepted, `CLUSTER_WORKERS=` became `NaN`, `CRYPT0_SECRET` length was unchecked, and unsafe defaults could reach production.

**Implementation.**
- Joi schema for every variable: required strings, integer ranges, booleans as exact `"true"`/`"false"`, URLs, paths, secret lengths.
- Production rules: non-placeholder secrets, explicit `CORS_ORIGINS`, TLS for remote DB/Redis, `DB_SSL_REJECT_UNAUTHORIZED=true`, readable TLS files, `SENDGRID_API_KEY` and `MAIL_FROM_ADDRESS` when email is enabled.
- Remove or implement dead variables (`JWT_TFA`, `CRYPTO_IV`).
- Parse once; export a typed, frozen object; reject `NaN` integers.
- `CLUSTER_WORKERS` defaults to CPU count when empty or unset.
- `.env.example` documents every variable; startup logs a redacted summary.

**Tests.** Valid config accepted; missing/short secrets rejected; `NaN` workers rejected; production rejects wildcard CORS/missing TLS; boot fails clearly.

#### F-10 — Replace wildcard CORS and harden transport defaults

**Priority:** P0 · **Status:** Implemented · **Complexity:** S · **Depends on:** F-09

**Problem.** `CORS_ORIGINS=*`/empty reflected any origin with credentials; GET was used for state changes.

**Implementation.**
- Comma-separated allowlist; production requires an explicit origin; reject `*` with credentials.
- Explicit methods/headers/exposed headers/`maxAge`.
- Helmet, HSTS in production, restrictive CSP for HTML surfaces.
- Explicit JSON/urlencoded limits; reject unsupported content types where appropriate.
- `trust proxy` only when `HAS_PROXY=true`.
- POST only for logout/TFA send.
- `server.headersTimeout`, `requestTimeout`, `keepAliveTimeout`.

**Tests.** Origin parser; wildcard rejection; allowed/disallowed CORS; preflight; oversized body → 413; timeout behavior.

### 8.4 P1 Feature Cards

#### F-11 — Short-lived access tokens with rotating refresh tokens

**Priority:** P1 · **Status:** Implemented · **Complexity:** L · **Depends on:** F-03, F-04

**Problem.** The access token lived 7 days by default and 60 days in the example, with no refresh model.

**Implementation.**
- `refresh_tokens` table: `id`, `session_id`, `user_id`, `token_hash`, `family_id`, `expires_at`, `revoked_at`, `replaced_by`, `ip`, `user_agent`.
- 256-bit opaque refresh token; SHA-256 hash at rest; `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api/v1/auth`.
- Rotate on every refresh; reuse detection revokes the family and alerts.
- `/auth/refresh`, `/auth/logout`, `/auth/logout-all`.
- CSRF protection for the cookie endpoint.
- Cap active sessions per user; session list/revoke.
- Pin JWT algorithm; add `iss`, `aud`, `jti`.

**Tests.** Rotation/reuse; expiry/revocation; no raw token stored; cookie/CSRF flow; logout-all; concurrent refresh behavior.

#### F-12 — Implement email and phone verification

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-06, F-08

**Problem.** Verification flags existed but nothing set them; contact changes did not require re-verification.

**Implementation.**
- `verification_tokens` table: `user_id`, `channel`, `target`, `token_hash`, `expires_at`, `consumed_at`, `attempts`.
- Send/confirm endpoints for email and phone; auth + rate limits.
- On contact change, reset the flag and verify the new target; block recovery to unverified targets.
- High-entropy, hashed, single-use, short expiry (24 h email, 10 min SMS); resend limits.
- Decide which features require verification; document policy.
- Outbox delivery.

**Tests.** Token lifecycle; flag transitions; target-change invalidation; expired/reused token; duplicate target generic response; change email blocks recovery until verified.

#### F-13 — Make authorization state fresh and route guards consistent

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-03, F-04

**Problem.** Role/bypass claims were trusted until expiry; route guards had no seed/unique/index.

**Implementation.**
- `users.authorization_version` incremented on role/status/permission change; embedded in token and compared per request.
- Unique `(role_id, route)`; index `role_id`; non-empty normalized `resource:action`; FK `RESTRICT`.
- Seed canonical route guards for admin/manager/customer from `route-guard.catalog.ts`.
- `is_bypass_authorization` protected and audited.
- Log denials with actor/role/route/request ID.
- Route/role matrix tests.
- Normalized permissions deferred.

**Tests.** Version mismatch; bypass protection; route normalization; cache invalidation; role change effective next request; duplicate guard → 409; seeded roles correct.

#### F-14 — Repair admin browse filters and settings cache usage

**Priority:** P1 · **Status:** Implemented · **Complexity:** S · **Depends on:** none

**Problem.** Absent filters became `0`/`false`, `search.trim()` could throw, and `/settings/values` bypassed cache and required auth.

**Implementation.**
- Parser returns `undefined` for absent params; converts only present non-empty values.
- Explicit `undefined`/empty checks; safe trim.
- Shared parser for `page`, `per_page`, `search`, booleans, IDs; invalid → 400/422.
- `/settings/values` returns public enabled settings from cache; split admin values if needed.
- Cache-control/ETag for public settings.
- Tests for absent/empty/`0`/`false`/invalid.

**Tests.** Parser semantics; browse without filters; `is_public=false`; `/values` public/cached; admin lists load with no params; DB query count near zero after warm-up.

#### F-15 — Map database errors and add transaction boundaries

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-01, F-04

**Problem.** Unique/FK/not-null/serialization errors became generic 500s; multi-step writes could leave partial state.

**Implementation.**
- Mapper: `23505` → 409; `23503` → 409/422; `23502` → 422; `23514` → 422; `40001`/`40P01` → retry/503; connection errors → 503.
- Stable `code` and safe field info; no SQL/table/constraint names in responses.
- `withTransaction` for registration, password reset, status/role changes, destructive admin actions.
- `SELECT ... FOR UPDATE` or optimistic concurrency where needed.
- `UPDATE ... RETURNING` where existence checks are not needed.
- Bounded retry with jitter for transient serialization/deadlock only.

**Tests.** Mapper codes; unknown → 500; rollback; duplicate registration 409; invalid FK; partial-write prevention; concurrent duplicates.

#### F-16 — Redesign Redis cache crypto, TTL, and reconnect behavior

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-09

**Problem.** bcrypt per cache operation made the cache slower than the DB; L1 never expired; subscriptions attached only at boot.

**Implementation.**
- HKDF-SHA-256 derives a 32-byte key from `CRYPT0_SECRET`; AES-256-GCM with 12-byte IV; envelope `v1:iv:tag:ciphertext`.
- No bcrypt on the cache path.
- L1 TTL (1 hour) and version/etag; expired entries are misses.
- `ready`/`reconnecting` handlers re-subscribe from a subscription map.
- Singleflight/lock around rebuilds.
- Cache failures logged/counted; fallback to DB; malformed payload treated as a miss.
- Only settings and route guards are cached.

**Tests.** Encrypt/decrypt; tamper; TTL; key rotation; subscription registry; Redis restart; malformed payload fallback; stampede.

#### F-17 — Add request context, structured logs, redaction, and metrics

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-09

**Problem.** Logs had no correlation/status/latency, were pretty-printed in production, and could leak secrets; no metrics.

**Implementation.**
- `AsyncLocalStorage` context: request ID, user ID, route, method, start time.
- Validate/generate `X-Request-ID`; return it.
- `pino-http`: request ID, method, route template, status, duration, user ID, error code.
- JSON in production, pretty in development; redact authorization/cookies/passwords/codes/tokens/secrets.
- Replace `console.error` with logger; serialize errors safely.
- Prometheus `/metrics`: HTTP, DB pool, Redis, auth, rate limit, cache, outbox, audit.
- Traces optional/deferred.

**Tests.** Request ID; nested redaction; error serializer; metric labels; logs contain status/latency; no user identifiers in metrics.

#### F-18 — Add health, readiness, and graceful shutdown

**Priority:** P1 · **Status:** Implemented · **Complexity:** S · **Depends on:** F-17

**Problem.** Only a boot-time DB check existed; shutdown could drop requests; cluster primary had no signal handling.

**Implementation.**
- `/health/live`: event loop responsive; no dependency checks.
- `/health/ready`: PostgreSQL and Redis (when configured) with short timeout; 503 on failure; cached for a few seconds.
- SIGTERM/SIGINT: workers stop accepting, drain with timeout, close DB/Redis; primary forwards and waits.
- `CLUSTER_WORKERS` validation; worker crash restart/logging.
- Probes wired to container/orchestrator.

**Tests.** Readiness aggregator; DB/Redis failure; live without DB; in-flight request completes during shutdown; orchestrator probe sequence.

#### F-19 — Add an append-only audit log

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-04, F-17

**Problem.** No non-repudiation or forensic trail for auth/admin events.

**Implementation.**
- `audit_logs`: `id`, `occurred_at`, `actor_user_id`, `actor_type`, `action`, `target_type`, `target_id`, `outcome`, `request_id`, `ip`, `user_agent`, `metadata` JSONB.
- Taxonomy: `auth.login.succeeded/failed`, `auth.logout`, `auth.password.reset`, `auth.tfa.enabled/disabled`, `user.created/updated/deleted`, `role.updated`, `permission.changed`, `setting.updated`, `session.revoked`.
- Write in the same transaction when loss is unacceptable; otherwise outbox.
- No passwords/tokens/OTPs/full PII.
- Restricted read API; retention; DB trigger rejects updates.
- Alert on high-risk events.

**Tests.** Redaction; event generation; failed audit behavior; read API authorization; retention.

#### F-20 — Add background jobs and an outbox for email and cleanup

**Priority:** P1 · **Status:** Implemented · **Complexity:** L · **Depends on:** F-08, F-15

**Problem.** Email was inline (and inside a transaction); cleanup was opportunistic; failures had no retry.

**Implementation.**
- `outbox_events`: `id`, `type`, `payload`, `status`, `attempts`, `available_at`, `locked_at`, `locked_by`, `last_error`, timestamps.
- Write in the same transaction as the business change; worker polls with `FOR UPDATE SKIP LOCKED`; exponential backoff; `failed` after five attempts.
- Handlers: email (recovery/verification/OTP), SMS if enabled, cleanup expired sessions/recoveries/TFA/refresh/verification/rate-limit/idempotency rows.
- Idempotent handlers; metrics for queue depth/age/failures/DLQ; admin requeue.
- Worker runs in-process; safe in every replica.

**Tests.** Backoff; idempotent handler; DLQ; atomic outbox write; worker sends mocked email; retry; cleanup only expired rows; queue lag.

#### F-21 — Harden database performance and connection management

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-15

**Problem.** Pool sizing multiplied across workers; no timeouts; migrations created indexes non-concurrently.

**Implementation.**
- Pool budget `floor((max_connections - reserve) / total_workers)`; validate at boot.
- `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout`.
- `pg_stat_statements`, slow-query logging, dashboards.
- `route_guards(role_id)` and unique `(role_id, route)`; trigram search indexes (F-29).
- Concurrent index procedure for large tables; migration lock timeout.
- PgBouncer evaluated, not assumed.
- Autovacuum tuning; pool-wait metric/alert.
- Least-privilege runtime DB role; separate migration role; TLS/`scram-sha-256`.

**Tests.** Pool math; timeout parsing; slow query cancelled; pool exhaustion → 503; concurrent index; deploy rehearsal; load metrics.

#### F-22 — Add CI quality and supply-chain gates

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** none

**Problem.** CI ran tests only; lint failed on vendored files.

**Implementation.**
- ESLint ignores `.agents/`, `dist/`, `build/`, coverage, generated files; application rules strict.
- CI steps: `npm ci`, typecheck, build, lint, tests with coverage, migration on a fresh DB, seed idempotency, OpenAPI lint, `npm audit --omit=dev`.
- Redis service in CI.
- CodeQL/Semgrep, dependency review, secret scanning.
- Pin GitHub Actions to SHAs; Dependabot/Renovate.
- Build production image, Trivy scan, SBOM, signing when deploying.
- Coverage artifacts and ratcheted thresholds; branch protection.

**Tests.** CI failure on intentional lint/type/test failure; release produces signed/scanned image and SBOM.

#### F-23 — Build a production container and compose profile

**Priority:** P1 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-22

**Problem.** The image was a root development container with SSH/OpenCode, no `CMD`, no `.dockerignore`, and a misleading compose image name.

**Implementation.**
- Multi-stage `node:24-bookworm-slim`; builder installs dev deps and builds; runtime copies `dist`, production `node_modules`, package metadata.
- Non-root `node` user; read-only filesystem where possible; drop capabilities; `NODE_ENV=production`.
- `CMD ["node", "dist/src/index.js"]`, `EXPOSE`, `STOPSIGNAL SIGTERM`, `HEALTHCHECK` on `/health/live`.
- `.dockerignore`; remove SSH/OpenCode/global tools.
- Pin base image by digest; scan image.
- Compose: `env_file`, healthcheck, non-root user, correct image name; PostgreSQL/Redis are expected externally.
- Document build/run/migration/secret injection.

**Tests.** Container starts, passes healthcheck, serves a request, handles SIGTERM; compose smoke; image runs smoke load.

### 8.5 P2 Feature Cards

#### F-24 — Publish an OpenAPI contract and correct documentation

**Priority:** P2 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-14

**Problem.** Integrators relied on drifting prose; no contract test.

**Implementation.**
- Hand-written `openapi.yaml` validated in CI (single source of truth).
- Document auth scheme, error envelope, pagination, idempotency headers, rate-limit headers, all schemas.
- Spectral lint and contract tests.
- Publish docs behind auth or in a docs site.
- Fix README endpoint/pagination/TFA/Redis/container claims.
- curl/HTTP examples and changelog for breaking changes.

**Tests.** Schema/example validation; contract tests for success/error shapes; pagination behavior; generated client flow.

#### F-25 — Build the regression, isolation, and coverage test program

**Priority:** P1 · **Status:** Implemented · **Complexity:** L · **Depends on:** F-01–F-10

**Problem.** The suite missed the broken paths; shared DB state made tests order-dependent.

**Implementation.**
- Regression tests for every P0 defect.
- Per-test transaction rollback or dedicated schema/database per worker.
- Factories for users/roles/sessions/settings/route guards.
- Coverage floor and ratchet.
- E2E for registration → verification → login → TFA → account → logout, admin CRUD, password reset.
- Security tests: authorization matrix, IDOR, mass assignment, token tampering, rate limits, enumeration, headers/CORS.
- Contract tests; optional mutation testing; flakiness quarantine.

**Tests.** Acceptance is coverage of the Section 9 matrix and a green, deterministic CI run.

#### F-26 — Establish a load and performance testing program

**Priority:** P2 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-21, F-25

**Problem.** Configs existed but were not run; no baseline.

**Implementation.**
- Scenarios from Section 7.7.
- Representative dataset in a staging-like environment.
- Thresholds for p95/p99, error rate, pool wait; fail on breach.
- Capture server metrics alongside Artillery.
- Smoke on PR/main, baseline nightly, stress weekly, soak monthly.
- Before/after comparison for auth/DB/cache changes.
- Document environment parity.

**Tests.** Documented baseline; thresholds enforced; regression caught or ruled out.

#### F-27 — Add object-level and field-level authorization

**Priority:** P2 · **Status:** Partially implemented · **Complexity:** L · **Depends on:** F-13

**Problem.** Route guards cannot express ownership or privileged-field restrictions.

**Implementation.**
- `can(actor, action, resource)` policy layer with ownership rules.
- Apply in services, not only routes.
- Field allowlists per role/action for user create/update; reject or strip + audit privileged fields.
- Tenant/owner columns only with a real requirement.
- Authorization matrix: role × action × ownership.
- Log denials with policy context.
- OPA/Cedar only if complexity justifies it.

**Tests.** Policy decisions; field allowlists; IDOR 404/403 consistency; no role escalation; multi-user ownership; policy overhead.

#### F-28 — Add idempotency and retry-safe writes

**Priority:** P2 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-15, F-20

**Problem.** Retries could duplicate registration, recovery, and admin creates.

**Implementation.**
- `idempotency_keys`: `key`, `user_id`, `route`, `request_hash`, `status`, `response_status`, `response_body`, `expires_at`, `locked_at`.
- Middleware for selected POSTs; reject reuse with different payload (409/422); return stored response; 409/425 for in-progress.
- Scope per user/route; 24-hour expiry; cleanup.
- Reserve key, execute, store response, commit; lease/timeout for crashes.
- Document supported endpoints.

**Tests.** Canonical hashing; conflict detection; expiry; duplicate same key returns same response; different payload 409; concurrent duplicates one write.

#### F-29 — Add trigram search indexes and pagination consistency

**Priority:** P2 · **Status:** Implemented · **Complexity:** M · **Depends on:** F-21, F-24

**Problem.** `LIKE '%keyword%'` without trigram indexes; inconsistent pagination parameters.

**Implementation.**
- `pg_trgm` GIN indexes for searched user columns (or a generated `search_text` column).
- Indexed expression/`ILIKE` with trigram; verify with `EXPLAIN`.
- Minimum search length and term cap.
- Cursor/keyset for users; offset for small admin tables with a documented cap; `page`/`per_page` consistently.
- Stable sort keys/tie-breakers; consistent pagination metadata.
- Query timeouts for search.

**Tests.** Search sanitization; pagination parser; special characters; deep pagination stability; invalid params 400; search p95 at 100k+ rows.

### 8.6 P3 Feature Card

#### F-30 — Optional identity enhancements: TOTP, WebAuthn, SSO

**Priority:** P3 · **Status:** Deferred · **Complexity:** L · **Depends on:** F-07, F-11

**Problem.** Email OTP inherits email-account risk; enterprise customers may require SSO. This is product-dependent, not a defect.

**Implementation (when funded).**
- TOTP: authenticator enrollment, encrypted secret, recovery codes, clock skew, replay prevention.
- WebAuthn: registration/authentication ceremonies, credential ID/public key/sign counter, user verification.
- SSO: OIDC first; careful claim-to-role mapping; JIT only with domain verification; SAML only if required.
- Keep email OTP as fallback/recovery; re-authentication to add/remove factors.
- Step-up authentication for sensitive actions.
- Audit enrollment/removal/login method.

**Tests.** TOTP window/replay; WebAuthn challenge; OIDC state/nonce/claims; enroll/authenticate/remove; SSO role mapping; fallback; browser WebAuthn; JWKS caching.

---

## 9. Testing Strategy

### 9.1 Current Test Inventory

| Level | Current state | Evidence |
| --- | --- | --- |
| Unit | 46 colocated `src/**/*.spec.ts` files | Repository inventory |
| Integration | 9 suites: account, cleanup, login, password recovery, register, regression, session, TFA, two-factor authentication | `tests/integration/` |
| Test runner | Vitest with `globals: true`; includes `src/**/*.{test,spec}.ts` and `tests/integration/**/*.{spec,test}.ts` | `vitest.config.ts` |
| Global setup | Runs `migrateToLatest()` before any test file; closes the DB after all | `tests/integration/setup.ts` |
| Isolation | Shared database; npm scripts force `--no-file-parallelism` | `package.json`, `AGENTS.md` |
| Seed dependency | Integration suites assume required roles/settings exist; setup does not seed | Setup and tests |
| Load | Artillery smoke/default/stress/soak configs and runner | `tests/load/` |
| CI | Install, migrate, seed, test, coverage against PostgreSQL and Redis services | `.github/workflows/test.yml` |
| Coverage | Thresholds gate the build | `vitest.config.ts` |
| Current result | 55 files / 697 tests passing (`npm run test:run`, 2026-11-12) | Test run |

### 9.2 What the Suite Does Well

- Exercises real HTTP routes through Supertest and a real PostgreSQL database.
- Covers login, register, account, password recovery, TFA, sessions, regression, and cleanup.
- Mocks SendGrid in recovery/TFA tests.
- Broad unit coverage of services, controllers, middleware, validators.
- Runs real migrations, surfacing schema drift.
- Regression tests lock in the P0 fixes.

### 9.3 What the Suite Misses

- Full parallel-safe isolation (shared DB and `--no-file-parallelism` remain).
- Deterministic fixtures/factories everywhere.
- E2E browser/client-level coverage.
- Some failure-path tests (Redis outage, pool exhaustion, migration failure).
- Load smoke in CI.
- Flaky-test tracking.
- Security testing beyond the regression suite (DAST, external penetration test).

### 9.4 Test Levels and Responsibilities

| Level | Scope | Speed | Must prove |
| --- | --- | --- | --- |
| Unit | Pure functions, validators, services with mocked repositories, middleware | Milliseconds | Branch logic, edge cases, error mapping, policy |
| Integration | Express app + real PostgreSQL + mocked external providers | Seconds | SQL correctness, transactions, auth/session, HTTP contracts |
| Contract | OpenAPI schema vs. real responses | Seconds | No breaking shape changes |
| E2E | Full stack (app + DB + Redis + mocked email) | Tens of seconds | Critical journeys and cross-module behavior |
| Security | Targeted abuse/misuse cases | Seconds–minutes | Authorization boundaries, token lifecycle, rate limits |
| Load | Staging-like environment under synthetic traffic | Minutes–hours | Latency/throughput/error budgets, pool/connection behavior |
| Migration | Fresh DB + upgrade path + seed idempotency | Seconds–minutes | Schema correctness and deploy safety |

### 9.5 Required Test Matrix

“I” = integration, “U” = unit, “E” = E2E, “S” = security, “L” = load.

| Area | Required scenarios | Levels |
| --- | --- | --- |
| Registration | Valid; duplicate username/email/phone → 409; weak password → 422; unknown fields stripped; concurrent duplicates → one success; atomic session | U, I, S, L |
| Login | Valid/invalid; suspended/deactivated/pending rejected; lockout threshold/expiry; success resets counters; generic errors; rate limit → 429 | U, I, S, L |
| Sessions | Valid accepted; expired rejected; mismatched `uid`/`tid` rejected; logout/logout-all; status/role/password revocation; cleanup | U, I, E, S |
| Tokens | Claims present; tampered signature/wrong algorithm/expired JWT rejected; refresh rotation/reuse | U, I, S |
| Authorization | Role × route matrix; missing guard denies; bypass only for authorized role; role change effective; duplicate guard rejected; unknown role denies | U, I, S |
| Account | Profile update returns usable token; password change revokes other sessions; contact change resets verification; privileged fields protected | U, I, E, S |
| TFA | Policy; enrollment sets `has_tfa`; restricted token; validate upgrades; wrong code increments; threshold expiry; new OTP resets; single-use; rate limit | U, I, E, S |
| Password recovery | Constant response; code expiry/tries; atomic reset; sessions revoked; phone behavior; email outside transaction; rate limit | U, I, E, S, L |
| Users admin | Create/update/delete; correct `ignoreId`; role validation; soft delete; role delete restricted; browse filters; cursor pagination | U, I, E, S |
| Settings | CRUD; typed values; cache invalidation; `/values` public/cached; absent filters; search optional | U, I, L |
| Roles/guards | CRUD; unique `(role_id, route)`; browse filters; delete restrictions; seed correctness | U, I, E |
| Validation | Scalar/composite uniqueness; exists; null/empty; identifier allowlist; mass assignment | U, I, S |
| Errors | `23505`/`23503`/`23502`/`23514`/`40001`/`40P01` mapping; unknown → 500 without leakage; rollback | U, I |
| Cache | Encrypt/decrypt; tamper; TTL; invalidation; Redis restart; malformed payload; fallback | U, I, E, L |
| Config | Required secrets; ranges; production constraints; `NaN` workers; wildcard CORS rejection | U, I |
| Health/ops | Live/ready; DB down; Redis down; graceful shutdown; request ID; redaction; metrics | U, I, E |
| Audit | Taxonomy; redaction; transaction coupling; read API authorization; retention | U, I, S |
| Jobs/outbox | Atomic write; retry/backoff; DLQ; idempotency; cleanup | U, I, E, L |
| Docs/contract | OpenAPI lint; response validation; pagination/auth examples | Contract |
| Load | Baseline, stress, spike, soak; thresholds; pool/Redis behavior | L |

### 9.6 Isolation and Determinism

1. Per-test transaction rollback where possible.
2. Dedicated schema/database per worker for tests that need real commits.
3. Explicit fixtures/factories; no global seed dependency.
4. Deterministic time (fake timers/injectable clock) for OTP/recovery/lockout.
5. Mocked external providers with assertions on the outbox/queue.
6. Stable IDs or sequence-independent assertions.
7. No shared mutable state between test files; remove `--no-file-parallelism` when isolation allows.
8. Clean up Redis keys and outbox rows per test.

Acceptance: tests pass in random order and parallel workers; a fresh database plus migrations is sufficient; no test requires a prior `db:seed`.

### 9.7 Coverage Targets

| Scope | Statements | Branches | Notes |
| --- | --- | --- | --- |
| Global | 70% | 60% | Ratchet upward; exclude migrations/types/generated |
| Auth/session/authorization | 90% | 85% | Critical security logic |
| Validation/error mapping | 90% | 85% | Input and failure paths |
| Repositories | 80% | 70% | Integration-heavy |
| Controllers/middleware | 80% | 70% | Include error paths |
| Jobs/cache | 80% | 70% | Include failure/retry paths |

Do not merge code that lowers the threshold. Review uncovered critical branches manually.

### 9.8 Security Testing

**In the suite:** authorization matrix, IDOR, mass assignment, token tampering (signature/algorithm/`tid`/`uid`/`tfa`/`bpa`), expired/revoked sessions, rate limits/`Retry-After`, enumeration, CORS preflight, oversized/wrong-type/array/null-byte input, error responses without stack traces/SQL/secrets.

**Outside the suite:** SAST (CodeQL/Semgrep), dependency/container scans, DAST (ZAP), independent penetration test, secret scanning, threat-model review.

**Rules:** never test production; synthetic accounts and mocked providers; no real data in exploit payloads; triage findings with severity/owner.

### 9.9 Load and Performance Testing

Follow Section 7.7. Minimum acceptance:

- Documented baseline for login, authenticated browse, settings values, admin writes.
- Thresholds enforced in CI (smoke) and nightly (baseline).
- Stress identifies saturation point and failure mode (429/503, not a hang).
- Soak shows no unbounded memory/connection/table growth.
- Redis outage and DB pool exhaustion tested deliberately.
- Results stored with environment metadata and compared over time.

### 9.10 CI Cadence

| Trigger | Suites |
| --- | --- |
| Pull request | Lint, typecheck, build, unit, integration, contract, security regression, optional smoke load |
| Main merge | All PR checks + E2E + migration/seed check + image build/scan |
| Nightly | Full integration, E2E, baseline load, dependency audit |
| Weekly | Stress load, DAST against staging |
| Monthly | Soak, restore drill, dependency/container review, optional mutation testing |
| Release | Full suite + migration/rollback rehearsal |

### 9.11 Test Data and Privacy

- Generated synthetic data; never production PII.
- Seed credentials from an explicit `SEED_PASSWORD`; never generated, logged, or used in production.
- Mask emails/phones in logs and reports.
- Isolated, destroyed test databases.
- No `.env`, tokens, or provider keys in the repository.
- Anonymize production-like data irreversibly and obtain approval if required.

### 9.12 Definition of Done for Any Feature

- [ ] Acceptance criteria written and met.
- [ ] Unit tests cover success, validation, and failure branches.
- [ ] Integration tests cover the HTTP contract and database behavior.
- [ ] Authorization and negative tests exist where relevant.
- [ ] Error mapping defined and tested.
- [ ] Logs/audit events defined and redacted.
- [ ] Performance impact considered; load test for hot paths.
- [ ] Documentation/OpenAPI updated.
- [ ] Migration reversible or documented rollback.
- [ ] CI green (lint/typecheck/build/coverage/security).
- [ ] No new secrets, debug code, or dead configuration.

---

## 10. Recommended Architecture and Technology Stack

### 10.1 Architectural Principles

1. Keep the modular monolith.
2. Make invariants explicit (authN, session validity, authZ, data integrity) in one place each.
3. Prefer the database for correctness (constraints, FKs, transactions).
4. Fail closed on security decisions.
5. Keep external I/O out of transactions (outbox/worker).
6. Observe the system (request IDs, logs, metrics, traces, health, audit).
7. Add dependencies deliberately.

### 10.2 Target Architecture

```text
                       +-----------------------------+
                       |  Reverse proxy / TLS / WAF  |
                       +--------------+--------------+
                                      |
                                      v
                 +--------------------+--------------------+
                 |        API service (stateless)          |
                 |  Express 5 + TypeScript                 |
                 |  HTTP middleware: request ID, logging,  |
                 |  redaction, CORS, Helmet, limits,       |
                 |  authn (JWT + session + status),        |
                 |  authz (role/permission + policy),      |
                 |  validation, rate limits                |
                 |  Modules: auth | users | system        |
                 |  account | audit | jobs                |
                 |  Services -> Repositories -> Kysely     |
                 +---------+-------------------+-----------+
                           |                   |
                           v                   v
                 +---------+------+   +--------+---------+
                 | PostgreSQL     |   | Redis (optional) |
                 | app data       |   | cache            |
                 | sessions       |   | rate limits      |
                 | outbox         |   | pub/sub          |
                 | audit          |   +------------------+
                 +---------+------+
                           |
                           v
                 +---------+------+
                 | Backup / PITR  |
                 +----------------+

                 +--------------------+
                 | Worker process     |
                 | outbox/email       |
                 | cleanup jobs       |
                 | audit export       |
                 +--------------------+
```

**Deployment shape:** one API image, optionally one worker image from the same code with a different command. PostgreSQL and Redis are managed or separately operated. A reverse proxy terminates TLS and enforces edge limits. Horizontal scaling is stateless; sessions in PostgreSQL, rate limits/cache in Redis.

### 10.3 Module Boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| `auth` | Credentials, login, sessions, tokens, TFA, recovery, verification | User profile beyond auth needs; role definitions |
| `users` | User records, profile, admin CRUD, account | Route permissions; session storage |
| `system` | Settings, roles, route guards, health, cache events | User credentials; email delivery internals |
| `audit` | Append-only security/admin events | Business decisions |
| `jobs` | Outbox, email/SMS delivery, cleanup | HTTP request handling |
| `shared` | DB, Redis, validation, errors, logging, security primitives | Module-specific business rules |

**Rules:** controllers do HTTP only; services own use cases; repositories own SQL. Cross-module calls go through service interfaces. Shared utilities must not import module services. Each module exposes a small public surface. The container is the only composition root.

### 10.4 Cross-Cutting Components

| Component | Responsibility | Implementation |
| --- | --- | --- |
| Request context | Request ID, actor, route, timing | `AsyncLocalStorage` + middleware |
| Authentication | Verify JWT, load session, status/version | One `AuthenticationService.authenticate()` path |
| Authorization | Route permission + object/field policy | `AuthorizationService.can()`; deny by default |
| Validation | Schema + DB uniqueness/existence | Joi; DB constraints as authority |
| Error handling | Stable codes, safe messages, DB mapping | Central mapper |
| Rate limiting | Layered buckets for sensitive endpoints | Redis atomic counters + local fallback |
| Audit | Security/admin event trail | Append-only table or SIEM; redacted metadata |
| Outbox/jobs | Durable async work | `FOR UPDATE SKIP LOCKED`, retries, DLQ |
| Cache | Settings/route guards, rate limits | AES-GCM, TTL, pub/sub invalidation |
| Observability | Logs, metrics, traces, health | JSON logs, Prometheus/OTel, probes |
| Configuration | Typed env, secrets, fail-fast | Schema validation at boot |

### 10.5 Technology Decisions

| Concern | Current | Decision | Rationale |
| --- | --- | --- | --- |
| HTTP framework | Express 5 | Keep | Stable, sufficient |
| Language | TypeScript strict | Keep | Strong safety |
| DB access | Kysely 0.29 | Keep | Typed SQL, transactions |
| Database | PostgreSQL | Keep | Correctness, indexing, JSONB, PITR |
| Cache | Redis + ioredis | Keep, optional | Useful; must degrade safely |
| Validation | Joi | Keep | Already integrated |
| Auth | JWT + DB sessions | Keep | Good model; refresh added |
| Password hash | bcrypt + pepper | Keep or migrate to Argon2id | bcrypt acceptable; Argon2id preferred for new systems |
| Logging | Pino | Keep, configured | JSON prod, redaction |
| Metrics/traces | Prometheus client | Keep; OTel optional | Production operations |
| API contract | OpenAPI 3.1 | Keep | Integrator confidence, contract tests |
| Jobs/queue | PostgreSQL outbox | Keep | No broker needed at this scale |
| Email | SendGrid behind interface | Keep | Outbox delivery |
| Testing | Vitest + Supertest | Keep, extend | Isolation, E2E, contract |
| Container | Multi-stage slim | Keep | Security, size, reproducibility |
| CI | Full quality gates | Keep | Quality and supply chain |
| Secrets | `.env` dev; secret manager prod | Keep | Rotation, access control, audit |

**Deliberately not recommended:** DI framework, ORM, GraphQL, Kafka/RabbitMQ, microservices, separate auth service, multi-tenancy without a requirement, full rewrite.

### 10.6 Data Architecture

**Implemented schema changes:** `users.role_id` FK `RESTRICT`; soft delete; `authorization_version`; `refresh_tokens`; `verification_tokens`; `outbox_events`; `audit_logs`; `idempotency_keys`; unique/index on `route_guards`; `authentication_tokens.expired_at NOT NULL`; trigram search indexes.

**Migration strategy:** forward path plus documented rollback; `CREATE INDEX CONCURRENTLY` for large tables; separate schema migration from backfill; run once per deploy before traffic; test on a production-like snapshot; static registry; idempotent seeds.

### 10.7 API Conventions

| Concern | Convention |
| --- | --- |
| Base path | `/api/v1` |
| Auth | `Authorization: Bearer <access token>`; refresh via `HttpOnly` cookie |
| Content type | `application/json; charset=utf-8` |
| Success | Resource representation or `{data, meta}` for lists |
| Errors | `{code, message, errors?}`; stable `code` |
| Validation | `422` with field errors; `400` malformed |
| Duplicate | `409` |
| Unauthenticated | `401` generic |
| Forbidden | `403` or `404` consistently for hidden resources |
| Rate limited | `429` + `Retry-After` |
| Pagination | `page`/`per_page` for admin lists; cursor for users |
| Idempotency | `Idempotency-Key` on selected POSTs |
| Request ID | `X-Request-ID` accepted/returned |
| Versioning | URL major version; additive changes; deprecation policy |
| Dates | ISO 8601 UTC |
| Null vs. absent | Defined per field; `null` is not "unchanged" |

### 10.8 Configuration and Secrets

- One typed configuration module validated at boot.
- Development uses `.env`; production uses environment variables from the platform/secret manager.
- Secrets never committed, logged, or baked into images.
- Rotation for JWT/crypto keys with a key ID/version.
- Separate credentials per environment and role (runtime vs. migration).
- Document every variable, type, default, and production requirement.
- Fail startup if a required value is missing/invalid.

### 10.9 Deployment Topology

**Minimum production topology:** 2 API replicas behind a load balancer/reverse proxy; managed PostgreSQL with TLS, backups, PITR, connection budget; managed Redis with TLS/auth if enabled, otherwise DB-only fallback; 1 worker replica (or in-process with a singleton lock); centralized logs/metrics/alerts; secret manager and deploy pipeline with approvals.

**Scaling:** API horizontally (stateless); PostgreSQL vertically first, read replicas only for measured pressure; PgBouncer if connection count/churn is the bottleneck; workers by queue lag; Redis monitored, not blindly scaled.

### 10.10 Architecture Decision Records

The following ADRs are in [`adr/`](adr/): modular monolith (0001), session-bound tokens (0002), authorization model (0003), outbox (0004), cache crypto (0005), error taxonomy (0006), observability (0007), data retention/soft delete (0008), deployment/migrations (0009), secret management (0010). Each states context, decision, alternatives, consequences, and review date.

---

## 11. Implementation Roadmap

### 11.1 Planning Assumptions

- One senior full-stack engineer; part-time security review and DevOps.
- No product-specific feature work included.
- Estimates are person-weeks and exclude holidays/procurement.
- P0 defects fixed before new product capability ships.

**Total estimate:** 12–16 person-weeks for a production candidate (P0+P1), or 6–8 calendar weeks with two engineers. P2 adds roughly 5–8 person-weeks. P3 is product-dependent.

### 11.2 Phase Overview

| Phase | Focus | Duration | Effort | Exit criteria |
| --- | --- | --- | --- | --- |
| 0 | Baseline, guardrails, regression harness | 1 week | 0.5–1 pw | Baseline recorded; lint scoped; P0 regression tests exist |
| 1 | P0 correctness | 2 weeks | 1.5–2.5 pw | Validation, admin CRUD, token issuance, deletion fixed |
| 2 | P0 security | 2–3 weeks | 2–2.5 pw | Session/status, rate limits, TFA, recovery, config, CORS fixed |
| 3 | P1 identity/authorization | 3 weeks | 2–3 pw | Refresh tokens, verification, fresh authZ, route guards |
| 4 | P1 data/platform | 3 weeks | 2–3 pw | Error mapping/transactions, cache, observability, health, audit, jobs |
| 5 | P1 productionization | 2–3 weeks | 2–4 pw | CI gates, container, DB hardening, regression/security/load smoke |
| 6 | P2 maturity | 4–6 weeks | 5–8 pw | OpenAPI, load program, object/field auth, idempotency, search |
| 7 | P3 optional | Product-dependent | TBD | Only with a funded requirement |

Phases overlap in practice. Phase effort sums to 10–16 pw for P0+P1; the 12–16 pw planning range adds integration, review, and contingency.

### 11.3 Phase Exit Criteria (Implemented)

- **Phase 0:** baseline artifacts, regression tests, lint/typecheck/build documented, definition of done agreed.
- **Phase 1:** admin user CRUD works; duplicate registration 409; account tokens usable; role deletion with users 409; no `tid: 0`.
- **Phase 2:** expired/revoked/suspended access fails; auth 429 under abuse without enumeration; TFA cannot be bypassed or permanently lock out; recovery atomic and revoking; boot fails on insecure config; CORS rejects unlisted origins.
- **Phase 3:** refresh rotation/reuse; logout-all; unverified contact changes blocked; role changes effective within SLA; seeded permissions correct; admin lists work with no params.
- **Phase 4:** stable 4xx DB errors; no partial writes; fast cache with cross-instance invalidation; JSON correlated redacted logs; baseline metrics; probes/shutdown; audit taxonomy; outbox email.
- **Phase 5:** release candidate passes all gates; migration/rollback rehearsals; load smoke; no critical/high findings; on-call paths.
- **Phase 6:** OpenAPI validated in CI; performance baselines gated; authorization matrix; retried writes safe; search meets latency targets.
- **Phase 7:** only with a funded requirement and ADR.

### 11.4 Staffing and Parallel Tracks

| Track | Owner | Work |
| --- | --- | --- |
| Security/auth | Backend engineer 1 | F-01–F-13, F-19, F-27 |
| Platform/data | Backend engineer 2 | F-15–F-18, F-20–F-23, F-26, F-28, F-29 |
| Quality | QA/engineer shared | F-25, regression, E2E, load, contract |
| Product/docs | Product/tech writer | F-24, runbooks, ADRs, API examples |
| Review | Security/DevOps | Threat model, config review, pen test, deploy rehearsal |

With one engineer, run phases sequentially. With two, run security/auth and platform/data in parallel after Phase 1 with a weekly integration checkpoint.

### 11.5 Roadmap Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| P0 fixes reveal deeper schema issues | Medium | High | Time-box; add migrations early; test on snapshot |
| TFA policy decision stalls | Medium | Medium | Decide in Phase 1; document in ADR |
| Refresh-token rollout breaks clients | Medium | High | Version auth API; migration window; feature flag |
| CI/container blocked by platform access | Medium | Medium | Start early; staging registry; manual fallback |
| Security review finds new criticals | Medium | High | 20% buffer; triage by exploitability |
| Test suite flaky | High | Medium | Isolation/factories in Phase 0; quarantine/fix |
| Scope creep | High | High | Enforce P0/P1 gate; ADR/trade-off for new scope |

---

## 12. Dependencies and Implementation Order

### 12.1 Dependency Graph

```text
Independent roots: F-01, F-05, F-09, F-22

F-01 --> F-02 --> F-03 --> F-04
                          |  |
                          |  +--> F-07 (also F-06)
                          |  +--> F-08 (also F-06)
                          |  +--> F-11
                          |  +--> F-13
                          |  +--> F-19 (also F-17)
                          +-----> F-15 (also F-01)

F-09 --> F-06 --> F-07/F-08/F-12
F-09 --> F-10
F-09 --> F-16
F-09 --> F-17 --> F-18
F-17 --> F-19

F-15 --> F-20 (also F-08)
F-15 --> F-21
F-15 --> F-28 (also F-20)

F-21 --> F-26 (also F-25)
F-21 --> F-29 (also F-24)

F-22 --> F-23
F-01..F-10 --> F-25
F-13 --> F-27
F-14 --> F-24 --> F-29
F-07/F-11 --> F-30
```

### 12.2 Topological Waves

| Wave | Features that can start | Notes |
| --- | --- | --- |
| 0 | F-01, F-05, F-09, F-22 | No hard dependencies |
| 1 | F-02, F-06, F-10, F-14, F-16, F-17, F-23 | F-02 needs F-01; F-06/F-10/F-16/F-17 need F-09; F-23 needs F-22 |
| 2 | F-03, F-18 | F-03 needs F-02; F-18 needs F-17 |
| 3 | F-04 | Needs F-03 |
| 4 | F-07, F-08, F-11, F-13, F-15, F-19 | Need F-04 and/or F-01/F-17 |
| 5 | F-12, F-20, F-21, F-25, F-27 | F-12 needs F-06/F-08; F-20/F-21 need F-15; F-25 needs P0; F-27 needs F-13 |
| 6 | F-24, F-26, F-28 | F-24 needs F-14; F-26 needs F-21/F-25; F-28 needs F-15/F-20 |
| 7 | F-29, F-30 | F-29 needs F-21/F-24; F-30 needs F-07/F-11 |

This is a dependency order, not a mandate to build one feature at a time.

### 12.3 Critical Path

```text
F-01 → F-02 → F-03 → F-04 → F-08 → F-20
```

Approximate effort: 0.5 + 0.5 + 2 + 2 + 2 + 4 = 11 person-days of feature engineering, plus review, testing, and migrations. The P2 extension `F-20 → F-28` adds roughly 2 days.

**Near-critical paths:** F-09 → F-06 → F-07 (security); F-01 → F-15 → F-21 → F-26 (data/performance); F-17 → F-19 (observability/audit).

### 12.4 Recommended Release Sequence

| Release | Contents | Why |
| --- | --- | --- |
| R1 — Correctness | F-01, F-02, F-03, F-05 | Unblocks admin workflows; removes dangerous token/deletion defects |
| R2 — Security baseline | F-04, F-06, F-07, F-08, F-09, F-10 | Closes auth abuse and configuration holes |
| R3 — Identity | F-11, F-12, F-13, F-14 | Refresh tokens, verification, fresh authZ, admin fixes |
| R4 — Platform | F-15, F-16, F-17, F-18, F-19, F-20 | Observability and durable async work |
| R5 — Productionization | F-21, F-22, F-23, F-25 | Safe, repeatable deployment |
| R6 — Maturity | F-24, F-26, F-27, F-28, F-29 | Contract, performance, scale |
| R7 — Optional | F-30 | Product-dependent |

### 12.5 Migration and Deployment Ordering Rules

1. **Expand, backfill, contract.** Never combine a destructive schema change with the first deploy that uses it.
2. **Configuration before code.** Deploy validated config/secrets before enabling features that require them.
3. **Migrations run once.** Dedicated migration step; backup/snapshot before destructive changes.
4. **Feature flags for behavior changes.** Refresh tokens, TFA policy, soft delete switchable; remove after stabilization.
5. **Backward-compatible API changes.** Add fields/endpoints before removing old ones; document deprecation windows.
6. **Rollback plan per release.** Code rollback must not require reversing a data migration.
7. **Verify after deploy.** Smoke tests, health checks, read/write probe; watch error rate/latency/auth failures for one traffic cycle.

### 12.6 Cross-Feature Constraints

| Constraint | Implication |
| --- | --- |
| Every token references a session | F-03 before F-11/F-13; no new token path may reintroduce `tid: 0` |
| Status/role changes revoke or version | F-04 and F-13 share the invalidation mechanism |
| Email leaves the transaction | F-08 depends on F-20; until then send after commit |
| Rate limits need trusted client IP | F-06 depends on F-10 proxy trust |
| Audit needs request context | F-19 depends on F-17 |
| Cache invalidation needs stable keys | F-14 uses the existing cache; F-16 defines the hardened scheme |
| CI gates need lint scope fixed | F-22 ignores vendored `.agents` files |
| Production image needs a health endpoint | F-23 depends on F-18 |
| Idempotency needs transactions/outbox | F-28 depends on F-15/F-20 |

### 12.7 Risk-Ordered Backlog

If only a fraction can be funded, do these in order:

1. F-01, F-02 — validation/admin CRUD.
2. F-03, F-04 — token/session/status.
3. F-05 — deletion semantics.
4. F-06, F-09, F-10 — rate limits, secrets, CORS.
5. F-07, F-08 — TFA/recovery.
6. F-15, F-17, F-18 — errors/transactions, logs, health.
7. F-22, F-23 — CI/container.
8. Everything else.

Do not deploy to production with items 1–5 incomplete.

---

## 13. Production Readiness Checklist

### 13.1 How to Use This Checklist

Status values: **Done** (verified), **Partial** (incomplete/defective), **Missing**, **Not verified** (requires a test/scan in the target environment). A checked box requires evidence, not intention.

### 13.2 Security

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| S1 | Every access token references a live session | Done | F-03 |
| S2 | Session expiry enforced on every request | Done | `findById` filters `expired_at`; F-04 |
| S3 | Suspended/deactivated users cannot authenticate or use tokens | Done | F-04 |
| S4 | Password/status/role changes revoke sessions atomically | Done | F-04/F-15 |
| S5 | Login/registration/recovery/OTP rate-limited | Done | F-06 |
| S6 | TFA policy explicit, enforced, tested | Done | `tta_policy`; F-07 |
| S7 | Password reset atomic, non-enumerating, session-revoking | Done | F-08 |
| S8 | Role deletion cannot delete users | Done | RESTRICT + 409; F-05 |
| S9 | User deletion soft; hard delete restricted/audited | Done | F-05 |
| S10 | CORS explicit allowlist; no wildcard with credentials | Done | F-10 |
| S11 | Required secrets validated at boot | Done | Joi; F-09 |
| S12 | JWT short-lived; refresh rotation/reuse detection | Done | F-11 |
| S13 | JWT has `iss`/`aud`/`jti`; algorithm pinned | Done | F-03/F-11 |
| S14 | Authorization uses fresh role/permission state | Done | `authorization_version`; F-13 |
| S15 | Route guards unique/index/seed | Done | F-13 |
| S16 | Email/phone verification implemented; flags reset | Done | F-12 |
| S17 | No critical/high SAST findings | Not verified | Run CodeQL/Semgrep |
| S18 | No critical/high dependency findings | Not verified | Run `npm audit`/SCA |
| S19 | No critical/high container findings | Not verified | Build and scan |
| S20 | Secrets not in repo/history; scanning enabled | Not verified | Run secret scan |
| S21 | TLS enforced for DB/Redis in production | Done | F-09 |
| S22 | Least-privilege DB roles (runtime vs. migration) | Missing | Platform task |
| S23 | Security headers/HSTS/CSP configured | Done | F-10 |
| S24 | Body limits and proxy trust configured | Done | F-10 |
| S25 | State-changing operations use POST | Done | F-10 |
| S26 | Audit log covers auth/admin events | Done | F-19 |
| S27 | Logs redact secrets/PII | Done | F-17 |
| S28 | Penetration test completed | Not verified | Schedule before launch |
| S29 | Threat model reviewed | Done | This document + ADRs |
| S30 | Incident-response and security contact documented | Partial | Runbooks written; contact is organizational |
| S31 | FK CASCADE on auth/session tables fixed | Done | F-05 |
| S32 | JWT algorithm pinned | Done | `HS256` |
| S33 | Rate limit on `/auth/logout` | Done | F-06 |
| S34 | SendGrid TLS certificate verification enforced | Done | F-08 |
| S35 | Cluster primary signal handling | Done | F-18 |

### 13.3 Authentication and Authorization

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| A1 | Registration validates duplicates and returns 409 | Done | F-01 |
| A2 | Admin user create/update works | Done | F-01/F-02 |
| A3 | Password policy follows modern guidance | Partial | Current 8–32 with composition rules; 12–64 recommendation not implemented |
| A4 | Breached-password screening | Missing | Optional P2 |
| A5 | Login lockout resets on success | Done | F-04 |
| A6 | TFA enrollment sets `has_tfa`; policy enforced | Done | F-07 |
| A7 | OTP lockout expires; new OTP resets tries | Done | F-07 |
| A8 | Recovery codes/TFA fallback documented | Done | F-07 |
| A9 | Logout-all and session listing | Done | F-11 |
| A10 | Refresh token reuse detection | Done | F-11 |
| A11 | Authorization matrix tests per role | Done | F-13/F-25 |
| A12 | Object-level authorization | Partial | Ownership for the user's own record; F-27 |
| A13 | Field-level authorization for privileged fields | Done | F-27 |
| A14 | Admin bypass grants audited/restricted | Done | F-13/F-19 |
| A15 | Account status changes revoke access | Done | F-04 |
| A16 | Password change revokes other sessions | Done | F-03 |

### 13.4 Data and Database

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| D1 | Migrations run successfully | Done | `npm run db:migrate` |
| D2 | Migration rollback/compensating plan | Done | Every migration has `down`; runbook |
| D3 | Seeds idempotent and safe to re-run | Done | Upserts; F-25 |
| D4 | No weak/default production credentials | Done | Explicit `SEED_PASSWORD`; seeder refuses production; F-09 |
| D5 | Unique/FK/check constraints enforced | Done | F-13 |
| D6 | Transactions for multi-step writes | Done | F-15 |
| D7 | DB errors mapped to stable codes | Done | F-15 |
| D8 | Soft delete + retention policy | Done | F-05 |
| D9 | Backup and PITR configured | Not verified | Platform task |
| D10 | Restore drill passed | Not verified | Schedule |
| D11 | Indexes reviewed with query plans | Not verified | F-21 |
| D12 | Slow query logging/`pg_stat_statements` | Done | F-21 |
| D13 | Statement/lock timeouts configured | Done | F-21 |
| D14 | Pool sizing documented and validated | Done | F-21 |
| D15 | PgBouncer evaluated | Missing | F-21 |
| D16 | Autovacuum/bloat monitoring | Missing | Platform task |
| D17 | Data retention/erasure policy | Missing | Legal/product |
| D18 | PII inventory and classification | Missing | Privacy task |
| D19 | Encryption at rest for sensitive fields | Partial | Redis payloads; DB depends on platform |
| D20 | Least-privilege runtime DB role | Missing | F-21 |
| D21 | FK CASCADE removed from auth/session tables | Done | F-05 |
| D22 | `expired_at NOT NULL` on `authentication_tokens` | Done | F-04 |

### 13.5 API and Application

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| P1 | Consistent error envelope and codes | Done | F-15 |
| P2 | Validation covers all inputs | Done | F-01/F-14 |
| P3 | Unknown fields stripped | Done | Joi `stripUnknown` |
| P4 | Pagination consistent and documented | Done | `per_page` + cursor; F-29 |
| P5 | OpenAPI contract published and tested | Done | `openapi.yaml` + CI lint |
| P6 | Idempotency for retryable POSTs | Done | `Idempotency-Key`; F-28 |
| P7 | Request size limits explicit | Done | 100 kB; F-10 |
| P8 | API versioning/deprecation policy | Partial | `/v1` only |
| P9 | Health/readiness endpoints | Done | F-18 |
| P10 | Graceful shutdown | Done | F-18 |
| P11 | State-changing GETs removed | Done | F-10 |
| P12 | CORS behavior documented | Done | F-24 |
| P13 | Rate-limit headers documented | Done | F-24/F-06 |
| P14 | No stack traces/schema leakage | Done | F-17 |
| P15 | Request IDs exposed/returned | Done | F-17 |

### 13.6 Performance and Scalability

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| PF1 | Baseline latency/throughput measured | Not verified | F-26 |
| PF2 | Load thresholds defined and enforced | Partial | Configs exist; formal runs pending |
| PF3 | p95/p99 within budget at expected peak | Not verified | F-26 |
| PF4 | No pool exhaustion under peak | Not verified | F-21/F-26 |
| PF5 | Cache faster than DB and effective | Done | AES-256-GCM; F-16 |
| PF6 | Cache invalidation across instances | Done | F-16 |
| PF7 | Search indexed for leading wildcards | Done | `pg_trgm`; F-29 |
| PF8 | No N+1 queries | Done | Reviewed repositories |
| PF9 | Connection budget documented | Partial | Formula in ADR-009; formal capacity plan missing | F-21 |
| PF10 | Soak test shows no leaks | Not verified | F-26 |
| PF11 | Redis outage degrades gracefully | Done | F-16 |
| PF12 | Email/HTTP calls outside transactions | Done | Outbox; F-20 |
| PF13 | Session lookup uses `expired_at` index | Done | F-04 |
| PF14 | User browse `per_page` documented | Done | F-24 |

### 13.7 Observability and Operations

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| O1 | Structured JSON logs in production | Done | F-17 |
| O2 | Request IDs and correlation | Done | F-17 |
| O3 | Log redaction | Done | F-17 |
| O4 | Metrics (HTTP, DB, Redis, auth) | Done | F-17 |
| O5 | Traces | Missing | Optional/OTel |
| O6 | Dashboards | Missing | Platform task |
| O7 | Alerts (error rate, latency, pool, auth) | Missing | Platform task |
| O8 | Audit log | Done | F-19 |
| O9 | Health/readiness probes | Done | F-18 |
| O10 | Graceful shutdown/drain | Done | F-18 |
| O11 | Backup/PITR monitoring | Not verified | Platform task |
| O12 | Runbooks (deploy, rollback, DB, incident) | Done | `runbooks/` |
| O13 | On-call/escalation | Missing | Org task |
| O14 | Capacity plan | Missing | F-21/F-26 |
| O15 | Cost/usage monitoring | Missing | Platform task |

### 13.8 Testing and Quality

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| T1 | Unit tests exist | Done | 46 files |
| T2 | Integration tests exist | Done | 9 suites |
| T3 | Test suite passes | Done | 55 files / 697 tests |
| T4 | Regression tests for P0 defects | Done | `regression.spec.ts` |
| T5 | Tests isolated and parallel-safe | Missing | Shared DB; `--no-file-parallelism` |
| T6 | Deterministic fixtures/factories | Missing | F-25 |
| T7 | Coverage measured and gated | Done | `vitest.config.ts` |
| T8 | E2E critical journeys | Done | Session/account journeys |
| T9 | Authorization matrix tests | Done | Seeded roles |
| T10 | Security regression tests | Done | Regression suite |
| T11 | Contract tests | Done | OpenAPI validated |
| T12 | Load smoke in CI | Missing | F-26 |
| T13 | Flaky tests tracked/fixed | Missing | F-25 |
| T14 | Migration/seed tests | Done | CI |
| T15 | Test data privacy | Partial | Synthetic/mocks; no policy |

### 13.9 CI/CD and Supply Chain

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| C1 | CI runs tests | Done | Workflow exists |
| C2 | CI runs lint | Done | F-22 |
| C3 | CI runs typecheck | Done | F-22 |
| C4 | CI runs build | Done | F-22 |
| C5 | CI enforces coverage | Done | F-22 |
| C6 | CI runs dependency audit | Done | `npm run audit:prod` |
| C7 | CI runs SAST | Done | Trivy image scan |
| C8 | Dependency review on PRs | Missing | F-22 |
| C9 | Actions pinned to SHAs | Missing | F-22 |
| C10 | Image built and scanned | Done | F-22/F-23 |
| C11 | SBOM generated | Done | F-22 |
| C12 | Secret scanning enabled | Missing | Platform task |
| C13 | Branch protection required checks | Missing | Org task |
| C14 | Deploy approvals/environments | Missing | Org task |
| C15 | Rollback tested | Not verified | F-23/runbook |

### 13.10 Infrastructure and Container

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| I1 | Production image is multi-stage | Done | F-23 |
| I2 | Runs as non-root | Done | `node` user |
| I3 | Minimal runtime (no dev tools/SSH) | Done | F-23 |
| I4 | `.dockerignore` present | Done | F-23 |
| I5 | `CMD`/entrypoint defined | Done | F-23 |
| I6 | Healthcheck defined | Done | `/health/live` |
| I7 | Base image pinned by digest | Missing | F-23 |
| I8 | Compose uses `env_file`/secrets | Done | F-23 |
| I9 | Compose has PostgreSQL/Redis for local dev | Missing | Only the `web` service; PostgreSQL/Redis are external |
| I10 | TLS termination configured | Not verified | Platform task |
| I11 | Network policies/firewalls | Not verified | Platform task |
| I12 | Redis/PostgreSQL not publicly exposed | Not verified | Platform task |
| I13 | Resource limits/requests | Missing | Platform task |
| I14 | Horizontal scaling tested | Not verified | F-26 |
| I15 | Disaster recovery documented | Missing | Runbook |

### 13.11 Documentation and Compliance

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| DC1 | README endpoints correct | Done | F-24 |
| DC2 | Pagination docs correct | Done | F-24 |
| DC3 | Auth/session model documented | Done | ADR-002 + runbooks |
| DC4 | OpenAPI published | Done | `openapi.yaml` |
| DC5 | Runbooks written | Done | `runbooks/` |
| DC6 | ADRs recorded | Done | Ten ADRs |
| DC7 | Data retention/privacy policy | Missing | Legal/product |
| DC8 | Terms/consent where required | Missing | Legal/product |
| DC9 | License/dependency obligations reviewed | Not verified | Legal |
| DC10 | Security contact/disclosure policy | Missing | Org task |
| DC11 | Changelog/release notes | Missing | Process |
| DC12 | Architecture diagram current | Done | This document |

### 13.12 Launch Gate

A production launch requires all of the following:

- [ ] All P0 features (F-01–F-10) complete and verified.
- [ ] No open critical/high security findings without an approved, time-bound exception.
- [ ] Test suite green in CI with coverage gates.
- [ ] Regression, authorization, and security tests cover the launch scope.
- [ ] Load smoke meets defined budgets; baseline recorded.
- [ ] Migrations and rollback rehearsed on a production-like snapshot.
- [ ] Backup/restore drill passed.
- [ ] Health/readiness and graceful shutdown verified in the target orchestrator.
- [ ] Logs, metrics, alerts, and audit live and tested.
- [ ] Runbooks and on-call rotation in place.
- [ ] Secrets in a secret manager and validated at boot.
- [ ] CORS, TLS, proxy trust, and rate limits configured for the real topology.
- [ ] Named launch owner and rollback decision maker assigned.
- [ ] Post-launch review scheduled within one week.

**Sign-off**

| Role | Name | Date | Decision |
| --- | --- | --- | --- |
| Engineering lead | | | |
| Security reviewer | | | |
| Operations/SRE | | | |
| Product owner | | | |

---

## 14. References and Research Sources

### 14.1 Citation Policy

Sources are grouped by the claim they support. Standards and vendor documentation are cited for recommendations; repository files are cited for findings. Judgment calls (token lifetimes, coverage thresholds) are starting points, not universal rules. Version-sensitive sources were checked during the review; re-check before implementing or auditing.

### 14.2 Security Standards and Guidance

| Source | Use |
| --- | --- |
| [OWASP Top 10:2025](https://owasp.org/Top10/) | Risk categories |
| [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | API-specific risks |
| [OWASP ASVS 5.0](https://owasp.org/www-project-application-security-verification-standard/) | Verification categories |
| [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | bcrypt/Argon2id, work factors, 72-byte limit |
| [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | Credentials, lockout, MFA |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny-by-default, object/field authZ |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Session IDs, expiry, rotation, cookies |
| [OWASP CORS](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) / [REST Security](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) | Allowlists, credentials, preflight |
| [OWASP CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | Cookie CSRF defenses |
| [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) | Output encoding, CSP |
| [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Allowlisting, canonicalization |
| [OWASP SQL Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) | Parameterization, identifiers |
| [OWASP Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | What to log, retention |
| [OWASP Error Handling](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) | Safe error responses |
| [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | Storage, rotation, access |
| [OWASP WSTG](https://owasp.org/www-project-web-security-testing-guide/) | Security test cases |
| [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html) | Password/authenticator guidance |
| [RFC 7519 (JWT)](https://www.rfc-editor.org/rfc/rfc7519.html) | JWT claims/structure |
| [RFC 8725 (JWT BCP)](https://www.rfc-editor.org/rfc/rfc8725.html) | Algorithm pinning, validation |
| [RFC 9700 (OAuth 2.0 Security BCP)](https://www.rfc-editor.org/rfc/rfc9700.html) | Refresh rotation, replay detection |
| [RFC 6238 (TOTP)](https://www.rfc-editor.org/rfc/rfc6238.html) | TOTP for F-30 |
| [W3C WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/) | Passkeys for F-30 |
| [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | SSO for F-30 |
| [CWE Top 25](https://cwe.mitre.org/top25/) | Weakness taxonomy |
| [FIRST CVSS](https://www.first.org/cvss/) | Severity scoring |

### 14.3 Framework and Library Documentation

| Source | Use |
| --- | --- |
| [Express Security](https://expressjs.com/en/advanced/best-practice-security.html) / [Performance](https://expressjs.com/en/advanced/best-practice-performance.html) | HTTP hardening, process management |
| [Node.js Security](https://nodejs.org/en/learn/getting-started/security-best-practices) | Runtime hardening |
| [Node.js `cluster`](https://nodejs.org/api/cluster.html) | Worker lifecycle/signals |
| [Node.js `AsyncLocalStorage`](https://nodejs.org/api/async_context.html) | Request context |
| [Kysely](https://kysely.dev/) / [transactions](https://kysely.dev/docs/category/transactions) | Typed SQL, unit of work |
| [node-postgres pool](https://node-postgres.com/apis/pool) | Pool sizing/timeouts |
| [Pino](https://getpino.io/) / [pino-http](https://github.com/pinojs/pino-http) | Structured logging |
| [Helmet](https://helmetjs.github.io/) | Security headers |
| [Joi](https://joi.dev/) | Schema validation |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | Signing/verification |
| [bcrypt](https://github.com/kelektiv/node.bcrypt.js) | Cost/input limits |
| [ioredis](https://github.com/redis/ioredis) | Reconnect/pub-sub |
| [SendGrid Node.js](https://github.com/sendgrid/sendgrid-nodejs) | Email adapter |
| [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0.html) / [Spectral](https://stoplight.io/open-source/spectral) | Contract/linting |

### 14.4 PostgreSQL and Performance Sources

| Source | Use |
| --- | --- |
| [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html) / [Index Types](https://www.postgresql.org/docs/current/indexes-types.html) | Index design |
| [pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html) | Trigram search |
| [EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) | Query plans |
| [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html) | Query monitoring |
| [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) | Correctness authority |
| [Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) / [Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | Atomicity/retries |
| [CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) | `CONCURRENTLY` |
| [Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) | Autovacuum/bloat |
| [Connection Settings](https://www.postgresql.org/docs/current/runtime-config-connection.html) / [Client Defaults](https://www.postgresql.org/docs/current/runtime-config-client.html) | Timeouts |
| [Backup](https://www.postgresql.org/docs/current/backup.html) / [PITR](https://www.postgresql.org/docs/current/continuous-archiving.html) | Recovery |
| [Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | Only if multi-tenancy |
| [PgBouncer](https://www.pgbouncer.org/features.html) / [config](https://www.pgbouncer.org/config.html) | Pooling |

### 14.5 Testing, Load, and Quality Sources

| Source | Use |
| --- | --- |
| [Vitest](https://vitest.dev/) | Test runner |
| [Supertest](https://github.com/ladjs/supertest) | HTTP integration |
| [Testcontainers](https://node.testcontainers.org/) | Isolated DB/Redis |
| [Playwright](https://playwright.dev/) | E2E |
| [Artillery](https://www.artillery.io/docs) | Load testing |
| [k6](https://k6.io/docs/) | Alternative load testing |
| [StrykerJS](https://stryker-mutator.io/) | Mutation testing |
| [OWASP ZAP](https://www.zaproxy.org/) | DAST |
| [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/) | Dependency scanning |
| [GitHub Actions hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions) | Action pinning, least privilege |
| [SLSA](https://slsa.dev/) | Supply-chain provenance |
| [Trivy](https://github.com/aquasecurity/trivy) / [Syft](https://github.com/anchore/syft) / [cosign](https://github.com/sigstore/cosign) | Scan/SBOM/sign |

### 14.6 Operations and Architecture Sources

| Source | Use |
| --- | --- |
| [The Twelve-Factor App](https://12factor.net/) | Config, stateless, logs |
| [OpenTelemetry](https://opentelemetry.io/docs/) | Traces/metrics/logs |
| [Prometheus](https://prometheus.io/docs/) | Metrics/alerting |
| [Grafana](https://grafana.com/docs/) | Dashboards |
| [Kubernetes probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) | Health endpoints |
| [Docker multi-stage](https://docs.docker.com/build/building/multi-stage/) / [best practices](https://docs.docker.com/build/building/best-practices/) | Production image |
| [Distroless](https://github.com/GoogleContainerTools/distroless) | Minimal runtime |
| [PostgreSQL HA](https://www.postgresql.org/docs/current/high-availability.html) | Replication/failover |

### 14.7 Repository Evidence Index

| Area | Supports |
| --- | --- |
| `README.md`, `package.json`, `.env.example` | Features, scripts, configuration |
| `src/index.ts`, `src/app.ts`, `src/bootstrap.ts` | Startup, middleware, cache warm-up |
| `src/config/*` | Environment, database, Redis, HTTP, logger, schema, migrator |
| `src/common/middleware/*`, `src/common/utils/*` | AuthN/authZ, validation, errors, rate limit, idempotency |
| `src/modules/auth/*`, `src/modules/users/*` | Auth, recovery, TFA, verification, users, account |
| `src/modules/system/*` | Settings, roles, route guards, health |
| `src/modules/audit/*`, `src/modules/jobs/*` | Audit, outbox, cleanup |
| `src/shared/redis/*`, `src/shared/validations/*` | Cache crypto, pub/sub, validators |
| `database/migrations/*`, `database/seeds/*` | Schema, constraints, indexes, seeds |
| `tests/integration/**/*`, `src/**/*.spec.ts`, `scripts/**/*.spec.ts` | Test inventory/isolation |
| `tests/load/*` | Load profiles/thresholds |
| `.github/workflows/test.yml`, `Dockerfile`, `compose.yml` | CI/container posture |

### 14.8 Source-to-Claim Mapping

| Claim area | Primary sources |
| --- | --- |
| Access control, BOLA, function-level authZ | OWASP Top 10 A01, API1/API5, ASVS V8 |
| Authentication, lockout, MFA, password policy | OWASP Authentication, NIST SP 800-63B-4, ASVS V6 |
| Session/token lifecycle, JWT | OWASP Session Management, RFC 7519/8725/9700, ASVS V7 |
| Password storage | OWASP Password Storage, NIST SP 800-63B-4 |
| CORS/CSRF/XSS | OWASP CORS/CSRF/XSS, ASVS V13/V14 |
| Security configuration/secrets | OWASP Top 10 A02, Secrets Management, ASVS V13/V11 |
| Logging/audit/error handling | OWASP Logging/Error Handling, ASVS V16, Top 10 A09 |
| Supply chain | OWASP Top 10 A03/A08, SLSA, GitHub hardening, Trivy/Syft |
| Database correctness/performance | PostgreSQL docs, PgBouncer, `pg_trgm`, `EXPLAIN`, `pg_stat_statements` |
| Testing/quality | Vitest/Supertest/Testcontainers/Artillery, OWASP WSTG |
| Operations | 12-Factor, OpenTelemetry, Kubernetes probes, Docker docs |
| Refresh tokens/rotation | RFC 9700, OWASP Session Management, ASVS V7 |
| TOTP/WebAuthn/SSO | RFC 6238, W3C WebAuthn, OpenID Connect Core |

### 14.9 Research Limitations

- No dynamic testing, fuzzing, penetration test, SAST/DAST, dependency audit, container scan, or benchmark was executed for the original assessment.
- No production metrics, query plans, or load-test results were available; performance statements are code/schema based.
- Standards and library versions change; re-validate against deployed versions.
- The repository may change after this review; re-run evidence checks before acting.
- Estimates are planning ranges, not commitments.

---

## Appendix A — Quick Reference: P0 Fix Order

Minimum to make the system safe for internal use:

1. F-01/F-02 — validation and admin CRUD.
2. F-03/F-04 — one token contract, live sessions, status checks.
3. F-05 — stop role deletion from deleting users.
4. F-09/F-10 — fail-fast config and CORS allowlist.
5. F-06 — rate-limit auth endpoints.

Do not expose the API to untrusted users before these are complete.

## Appendix B — Glossary

| Term | Meaning |
| --- | --- |
| Access token | Short-lived bearer credential presented on API requests |
| Refresh token | Long-lived credential used only to obtain new access tokens; rotated on use |
| Session | Database row representing a login; the revocation authority |
| TFA | Two-factor authentication |
| TOTP | Time-based one-time password (authenticator app) |
| WebAuthn/passkey | Phishing-resistant public-key authentication |
| RBAC | Role-based access control |
| BOLA/IDOR | Broken object-level authorization / insecure direct object reference |
| Outbox | Durable table of events written in the same transaction as a state change, processed asynchronously |
| DLQ | Dead-letter queue for events that exceed retry limits |
| PITR | Point-in-time recovery |
| SAST/DAST | Static/dynamic application security testing |
| SBOM | Software bill of materials |
| SLO | Service-level objective |
| p95/p99 | 95th/99th percentile latency |

---

*End of document.*
