# Production Readiness and Feature Blueprint

**Project:** Express.js 5 + TypeScript + PostgreSQL API boilerplate  
**Document date:** 2026-11-11  
**Scope:** Architecture, security, performance, database, testing, and a prioritized implementation plan  
**Deliverable:** the blueprint in this document, and the implementation that followed it.

> **Evidence standard.** The assessment below is based on a full read of the repository, its configuration, migrations, routes, middleware, services, repositories, tests, CI, and container files, plus `tsc --noEmit`, `npm run lint`, `npm run db:migrate`, a database connectivity check, and two read-only validation probes against the configured development database.

> **Status of this document.** Sections 1.4 and the feature cards in Section 8 record the implementation that followed the assessment. The defect and gap registers in Sections 4 and 5 describe the state *before* that work and are kept as the record of what was found. The checklists in Section 13 reflect the implemented state.

---

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
| **Existing** | Implemented and verified by code inspection; may still have defects documented elsewhere. |
| **Incomplete** | Present but broken, inconsistent, unenforced, or missing a required part of the workflow. |
| **Missing** | Not implemented. |
| **Recommended** | Proposed work that is not currently in the repository. |
| **P0** | Blocks production use. Security, data-loss, or core functional defect. Fix first. |
| **P1** | Required for a credible production deployment. High operational or security value. |
| **P2** | Scale, maturity, or efficiency improvement. Do after P0/P1. |
| **P3** | Optional or product-dependent. Defer until there is a concrete need. |

**Complexity scale (rough, one experienced engineer):** S = less than 1 day; M = 1–3 days; L = 3–10 days; XL = more than 10 days. Estimates exclude product-specific requirements, review time, and deployment windows.

---

## 1. Executive Summary

### 1.1 Overall Verdict

This repository is a credible modular-monolith foundation, not a disposable prototype. It uses Express 5, strict TypeScript, Kysely with parameterized SQL, PostgreSQL, optional Redis caching, Joi validation, JWT plus database-backed sessions, bcrypt password hashing with a pepper, Helmet, compression, cursor pagination for users, migrations, seeds, unit tests, integration tests, and Artillery load-test configurations. The layering is understandable: routes and middleware feed controllers, controllers call services, services use repositories, and repositories use Kysely.

It is **not production-ready today**. The most serious problems are not missing “nice-to-have” features. They are broken security invariants and core functional defects in the authentication, session, authorization, and validation paths:

1. **Admin user creation and updates always fail validation.** `userCreateSchema` and `userUpdateSchema` validate `role_id` against a non-existent `roles.role_id` column. A read-only probe returned `database.error (role_id)`.
2. **Uniqueness validation is ineffective for scalar fields.** Joi’s `.external()` receives a scalar value, but `validateCompositeUnique` treats it as an object and reads `value[column]`, which is `undefined`. A probe confirmed that `registerSchema` accepts the already-existing username `admin`; the duplicate then reaches the database and is likely returned as a generic 500.
3. **Account changes mint tokens with `tid: 0` and no role or bypass claims.** `AccountService.information` and `AccountService.password` issue JWTs that skip the session-existence check (`tid > 0` is false) and cannot pass route authorization because `rol` is absent.
4. **Session expiry is not enforced.** `AuthenticationTokenRepository.findById` does not filter on `expired_at`, so an expired database session remains usable for as long as the JWT is valid.
5. **Account status is ignored at login.** Suspended, deactivated, and pending users can authenticate. Existing sessions are not revoked when status changes.
6. **Role deletion can delete users.** `users.role_id` uses `ON DELETE CASCADE`; deleting a role silently deletes every user assigned to it. User deletion is also a hard delete, and `softDelete` is unused.
7. **Authentication abuse controls are missing or defective.** There is no IP/account rate limiting on login, registration, password recovery, or OTP endpoints. Successful login does not reset `login_tries`. TFA’s `tries >= 5` path never sets `expired_tries_at`, and reissuing an OTP does not reset `tries`, producing a permanent lockout for that token.
8. **Password recovery has security and consistency defects.** It leaks account existence through the presence of `next_resend_at`, sends email inside a database transaction, changes the password and deletes the recovery row outside a transaction, does not revoke sessions, and silently accepts phone recovery while sending nothing.
9. **Secure configuration is not enforced.** Empty `JWT_SECRET`, `BCRYPT_SECRET`, and `CRYPT0_SECRET` values are accepted at boot. CORS defaults to reflecting any origin with credentials. The example JWT lifetime is 60 days.
10. **Several admin list endpoints are broken.** `settings`, `roles`, and `route-guard` browse controllers use `numeric()` defaults of `0` and compare `get()` results to `null`. This produces unintended `is_disabled=false`, `is_public=false`, or `role_id=0` filters and can throw when `search` is absent.
11. **Operational readiness is thin.** There are no request IDs, structured production logs, redaction, health/readiness endpoints, metrics, traces, audit logs, OpenAPI contract, background jobs, or scheduled cleanup. CI runs tests only. The Dockerfile is a development container that runs as root and configures SSH and OpenCode.

### 1.2 Highest-Risk Findings

| # | Finding | Why it matters | Priority |
| --- | --- | --- | --- |
| 1 | Scalar uniqueness and role-existence validation are broken | Admin user management is unusable; duplicate registration reaches the database and would return a generic 500 instead of 409 | P0 |
| 2 | `tid: 0` account tokens bypass session checks and lack authorization claims | Revocation is bypassed and account endpoints issue unusable tokens | P0 |
| 3 | Expired sessions are accepted | A stolen or old JWT remains valid beyond the intended database session lifetime | P0 |
| 4 | Login ignores user status | Suspended/deactivated users retain access; status changes do not revoke sessions | P0 |
| 5 | Role deletion cascades to users; user deletion is hard | A routine admin action can destroy accounts and audit evidence | P0 |
| 6 | No auth rate limiting; lockout/TFA lockout defects | Credential stuffing, password guessing, OTP brute force, and email bombing are practical | P0 |
| 7 | Password recovery leaks existence and does not revoke sessions | Account enumeration and continued use of stolen sessions after a reset | P0 |
| 8 | TFA is not enforced consistently | The account routes demand `tfa`, login never requires it, and no flow sets `has_tfa` | P0 |
| 9 | CORS wildcard with credentials; secrets not validated; 60-day JWT | Unsafe defaults can reach production | P0 |
| 10 | Admin browse endpoints and settings cache are broken | Operational admin workflows fail or hammer the database | P1 |
| 11 | No observability, audit trail, or production container/CI gates | Incidents are hard to detect, investigate, or prevent | P1 |

### 1.3 Recommended Direction

Do **not** add new product features before closing the P0 items. The correct sequence is:

1. **Repair correctness first.** Fix validation, user create/update, account token issuance, session expiry, status enforcement, and destructive deletion semantics.
2. **Then harden authentication and authorization.** Add abuse controls, repair TFA, make password recovery atomic and non-enumerating, and ensure authorization decisions use fresh role state.
3. **Then build production plumbing.** Add refresh tokens, verification flows, audit logging, observability, database constraints/indexes, transaction boundaries, reliable seeds, CI gates, and a production container.
4. **Only then add scale/maturity features.** OpenAPI, outbox jobs, idempotency, permission normalization, advanced search, and optional SSO/passkeys.

A realistic estimate for a production candidate is **12–16 person-weeks** for one senior engineer, or **6–8 calendar weeks with two engineers**, excluding product-specific features. P0 alone is roughly **4–6 person-weeks** including regression tests and security verification; P1 is roughly **6–10 person-weeks**. These are planning estimates, not commitments.

### 1.4 Implementation Status

The features in this blueprint have been implemented. The state of the
repository after the implementation work:

| Area | State |
| --- | --- |
| P0 (F-01 to F-10) | Implemented and covered by the regression suite. |
| P1 (F-11 to F-23, F-25) | Implemented. |
| P2 (F-24, F-26 to F-29) | Implemented, except F-27 which is partially implemented (the field-level rules and the ownership checks are in place; there is no generalized policy layer for every resource type). |
| P3 (F-30) | Deferred on purpose: this phase "only starts with a funded requirement and a written ADR". The deferral and the remaining decisions are recorded in [`docs/adr/README.md`](adr/README.md). |

Where the work lives:

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
| Contract | `docs/openapi.yaml`, validated by `scripts/openapi-lint.ts` |
| Decisions | `docs/adr/` |
| Procedures | `docs/runbooks/` |
| Regression suite | `tests/integration/regression.spec.ts`, `tests/integration/session.spec.ts` |

Verification commands: `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run test:run`, `npm run test:coverage`, `npm run openapi:lint`,
`npm run audit:prod`.

### 1.5 Explicit Non-Goals

This blueprint does **not** recommend:

- Splitting the system into microservices.
- Replacing Express, Kysely, or PostgreSQL.
- Introducing GraphQL, Kafka, or a separate authentication service.
- Adding multi-tenancy before there is a real tenant requirement.
- Rewriting the application from scratch.
- Adding features that are not tied to a verified risk or operational need.

The existing modular monolith is the right architecture for this codebase. The work is to make its invariants explicit, tested, and enforceable.

---

## 2. Project Overview

### 2.1 Purpose

The project is a REST API boilerplate for building authenticated applications quickly. It provides:

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

| Layer | Technology | Version / notes |
| --- | --- | --- |
| Runtime | Node.js | CI uses Node 24; Dockerfile installs Node 24 |
| Language | TypeScript | `^6.0.3`, `strict: true`, target `ES6` |
| HTTP | Express | `^5.3.0` |
| Database | PostgreSQL | `pg` `^8.23.1`; Kysely `0.29.8` |
| Cache / pub-sub | Redis | `ioredis` `^6.0.0`; optional at boot |
| Validation | Joi | `^18.3.2`, custom phone extension |
| Auth | `jsonwebtoken` | `^9.0.3`; HS256 by default |
| Password hashing | `bcrypt` | `^6.0.0`; pepper via `BCRYPT_SECRET` |
| Encryption | Node `crypto` | AES-256-GCM for Redis cache payloads |
| Logging | Pino + pino-pretty | `^10.4.0` / `^13.2.0` |
| Email | SendGrid | `@sendgrid/mail` `^8.1.6` |
| Testing | Vitest + Supertest | `^5.1.0` / `^7.3.2` |
| Load testing | Artillery | `^2.0.34` |
| Container | Ubuntu 26.04 | Development-oriented Dockerfile |
| CI | GitHub Actions | Tests only; PostgreSQL service; no Redis service |

### 2.3 Repository Layout

| Path | Responsibility |
| --- | --- |
| `src/index.ts` | Process entry; optional Node cluster; HTTP server; shutdown |
| `src/app.ts` | Express app assembly; middleware; `/api/v1`; 404; error handler |
| `src/bootstrap.ts` | Cache warm-up and Redis subscriptions |
| `src/routes/v1.ts` | Module router composition |
| `src/config/` | Environment, database, Redis, HTTP, logger, schema, migrator, container |
| `src/common/middleware/` | Request sanitization/pagination, response helpers, errors, validation, authentication, authorization, TFA |
| `src/common/utils/` | Errors, messages, dates, security primitives, `catchAsync` |
| `src/modules/auth/` | Authentication, sessions, TFA, password recovery |
| `src/modules/users/` | Users, account profile/password |
| `src/modules/system/` | Settings, roles, route guards, cache events |
| `src/shared/redis/` | Encrypted cache and pub/sub subscriber |
| `src/shared/validations/` | Joi extensions and database uniqueness/existence validators |
| `src/infrastructure/mail/` | SendGrid adapter |
| `database/migrations/` | Seven Kysely migrations |
| `database/seeds/` | Users/roles and settings seeds |
| `tests/integration/` | Five HTTP integration suites and global setup |
| `tests/load/` | Artillery configs, data, hooks, runner |
| `docs/testing/` | Existing integration and load-test documentation |
| `.github/workflows/test.yml` | CI test workflow |

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
  |-- 404 handler
  |-- errorHandler
  |
  v
Route middleware
  |-- AuthenticationMiddleware: verify JWT; optional session lookup
  |-- AuthorizationMiddleware: check role slug against cached route guards
  |-- TwoFactorAuthenticationMiddleware: require jwt.tfa
  |-- validate: sanitize selected fields; Joi validateAsync
  |
  v
Controller -> Service -> Repository -> Kysely -> PostgreSQL
                              |
                              +-> Redis cache/pub-sub (optional)
                              +-> SendGrid (password recovery / OTP)
```

### 2.5 Data Model

| Table | Purpose | Key constraints / indexes |
| --- | --- | --- |
| `settings` | Runtime configuration | `name` unique, `slug` unique; `is_disabled`, `is_public`; no explicit browse indexes beyond uniques |
| `roles` | Role catalog | `slug` unique; `is_bypass_authorization`; index on `created_at` |
| `users` | Accounts | `phone` unique, `email` unique, `username` unique; `role_id` FK **ON DELETE CASCADE**; status/gender check constraints; browse indexes on `(deleted_at, role_id, status, id)`, `(deleted_at, status, id)`, `(deleted_at, role_id, id)`, `(deleted_at, id)` |
| `authentication_tokens` | Revocable sessions | `user_id` FK **ON DELETE CASCADE**; indexes on `user_id`, `expired_at`, `created_at`; `expired_at` is nullable |
| `two_factor_authentications` | Email OTP state | `token_id` unique FK **ON DELETE CASCADE**; `tries`, `next_send_at`, `expired_tries_at`, `expired_at`; index on `(token_id, expired_at)` |
| `password_recoveries` | Recovery codes | Unique `(type, send_to)`; type check; indexes on `(type, send_to)`, `next_resend_at`, `expired_at`, `next_try_at` |
| `route_guards` | Role-to-route allow list | `role_id` FK **ON DELETE CASCADE**; **no unique `(role_id, route)`**; **no index on `role_id`** |

### 2.6 API Surface

All paths are prefixed with `/api/v1`.

| Method | Path | Authentication | Authorization | Notes |
| --- | --- | --- | --- | --- |
| POST | `/auth/register` | Public | — | Creates a customer user and returns a JWT |
| POST | `/auth/login` | Public | — | Returns a JWT; does not require TFA |
| POST | `/auth/logout` | Bearer | — | Deletes the current session |
| POST | `/auth/tfa/send` | Bearer | — | Sends OTP |
| POST | `/auth/tfa/validate` | Bearer | — | Verifies OTP; returns a new JWT with `tfa: true` |
| POST | `/auth/password-recovery/send` | Public | — | Sends recovery code; leaks existence via response shape |
| POST | `/auth/password-recovery/validate` | Public | — | Resets password; does not revoke sessions |
| PUT | `/account/information` | Bearer + `tfa` | — | Updates profile; returns `tid: 0` token |
| PUT | `/account/password` | Bearer + `tfa` | — | Changes password/username/email/phone; returns `tid: 0` token |
| POST | `/users` | Bearer | `users:create` | Broken by role validator |
| PUT | `/users/:id` | Bearer | `users:update` | Broken by role validator and wrong `ignoreId` |
| GET | `/users` | Bearer | `users:browse` | Cursor pagination |
| GET | `/users/:id` | Bearer | `users:view` | Public columns only |
| DELETE | `/users/:id` | Bearer | `users:delete` | Hard delete |
| POST | `/settings` | Bearer | `settings:create` | Invalidates cache |
| PUT | `/settings/:id` | Bearer | `settings:update` | Invalidates cache |
| GET | `/settings` | Bearer | `settings:browse` | Broken filters / `search` handling |
| GET | `/settings/values` | Bearer | — | Public values, but requires auth; bypasses cache |
| GET | `/settings/:id` | Bearer | `settings:view` | — |
| DELETE | `/settings/:id` | Bearer | `settings:delete` | Hard delete |
| POST | `/roles` | Bearer | `roles:create` | — |
| PUT | `/roles/:id` | Bearer | `roles:update` | — |
| GET | `/roles` | Bearer | `roles:browse` | Broken filters / `search` handling |
| GET | `/roles/:id` | Bearer | `roles:view` | — |
| DELETE | `/roles/:id` | Bearer | `roles:delete` | Cascades to users |
| POST | `/route/guards` | Bearer | `route-guards:create` | No uniqueness constraint |
| GET | `/route/guards` | Bearer | `route-guards:browse` | Broken `role_id=0` filter |
| GET | `/route/guards/:id` | Bearer | `route-guards:view` | — |
| DELETE | `/route/guards/:id` | Bearer | `route-guards:delete` | — |

### 2.7 Configuration Surface

| Variable | Default / behavior | Assessment |
| --- | --- | --- |
| `NODE_ENV` | `development` | Fine |
| `PORT` / `PORT_EXPOSE` | `4000` | Fine |
| `HAS_PROXY` | `false` | Needed for correct `req.ip` behind a proxy |
| `CORS_ORIGINS` | empty / `*` reflects any origin | Unsafe default with credentials |
| `CLUSTER` / `CLUSTER_WORKERS` | `false` / absent parses to `0` (effective 1 worker), empty string yields `NaN` | `NaN` can start zero workers; the effective default is not CPU count |
| `DB_*` | host/user/pass/name empty | No required validation |
| `DB_POOL_MIN` / `MAX` | `2` / `10` per worker | Cluster multiplication risk |
| `DB_SSL` / `DB_SSL_REJECT_UNAUTHORIZED` | `false` / `true` when SSL is enabled | TLS file paths not validated until use |
| `REDIS_*` | optional | No reconnect subscription logic |
| `SENDGRID_API_KEY` | empty | Mail fails at runtime |
| `JWT_SECRET` | empty | Token generation fails at first use |
| `JWT_EXPIRATION_DAYS` | `7` in code, `60` in `.env.example` | Long-lived access token |
| `JWT_TFA` | parsed but unused | Dead configuration |
| `BCRYPT_SECRET` | empty | Hashing fails at runtime |
| `BCRYPT_SALT_ROUND` | `0`/`NaN` possible; falls back to 10 in most call sites | Inconsistent |
| `CRYPT0_SECRET` | empty; must be 32 bytes for AES-256-GCM | No validation |
| `CRYPT0_CIPHER` | empty; defaults to `aes-256-gcm` | Fine if validated |
| `CRYPTO_IV` | parsed but unused | Dead configuration |

### 2.8 Testing and Deployment Assets

| Asset | Current state |
| --- | --- |
| Unit tests | 34 colocated `src/**/*.spec.ts` files |
| Integration tests | 5 files: account, login, register, password recovery, TFA |
| Load tests | Artillery configs for smoke, default, stress, soak |
| CI | GitHub Actions: install, migrate, seed, test |
| Container | Single-stage Ubuntu development image |
| Compose | One `web` service; no PostgreSQL/Redis services; no `env_file` |
| Docs | README, `docs/testing/integration.md`, `docs/testing/load-performance.md` |

---

## 3. Existing Architecture and Features

### 3.1 Architecture Style

The application is a **modular monolith** with manual dependency injection. There is no DI framework. `src/config/container.ts` constructs repositories, services, the mail adapter, cache components, and event handlers. Some route modules instantiate their own controllers and services instead of importing the container, which creates two wiring styles and makes testing/configuration less consistent.

The layering is mostly clean:

- **HTTP layer:** Express routes, middleware, controllers.
- **Application layer:** services such as `AuthenticationService`, `UserService`, `AccountService`, `TwoFactorAuthenticationService`, `PasswordRecoveryService`, `SettingService`, `RoleService`, `RouteGuardService`.
- **Persistence layer:** repositories using Kysely, with `DatabaseExecutor` supporting both the shared database and transactions.
- **Cross-cutting:** validation, errors, security utilities, cache, mail.

### 3.2 Module Inventory

| Module | Main responsibilities | Assessment |
| --- | --- | --- |
| `auth/authentication` | Register, login, logout, JWT creation/verification, session records | Core flow works, but status, expiry, lockout reset, and token claims are defective |
| `auth/two-factor-authentication` | OTP issue/verify, email delivery | Present but not enforced; lockout and `has_tfa` defects |
| `auth/password-recovery` | Email/phone recovery codes, password reset | Present but phone no-op, enumeration leak, no session revocation, weak transaction boundary |
| `users` | User CRUD, cursor browse, account profile/password | Admin create/update broken; hard delete; account token defects |
| `system/settings` | Settings CRUD, typed values, cache | Browse broken; `/values` bypasses cache; cache crypto is expensive |
| `system/roles` | Role CRUD | Browse broken; delete cascades users |
| `system/route-guards` | Role-to-route mappings, cached authorization | Browse filter broken; no unique/index; no seed data |
| `shared/redis` | Encrypted cache, pub/sub | Works in ideal path; expensive crypto, weak reconnect/TTL behavior |
| `infrastructure/mail` | SendGrid adapter | Works when configured; no outbox/retry |

### 3.3 Feature Matrix

| Feature | Status | Evidence / notes |
| --- | --- | --- |
| PostgreSQL connection and health check | Existing | `checkDbConnection`; `db:migrate` exited 0 |
| Kysely migrations | Existing | Seven migrations, static registry |
| Seeders | Incomplete | Non-idempotent; no route-guard seed; weak default password |
| Registration | Incomplete | Duplicate username can reach DB; no transaction; no email verification |
| Login | Incomplete | Status ignored; lockout not reset on success; no rate limit |
| JWT issuance/verification | Incomplete | No `iss`/`aud`/`jti`; no algorithm pinning; long expiry |
| Revocable sessions | Incomplete | Expiry not checked; `tid: 0` bypass; no logout-all |
| Logout | Existing | Deletes current session; state-changing GET |
| Role-based route guards | Incomplete | Works only for admin bypass by default; no seed; stale claims; no uniqueness/index |
| TFA email OTP | Incomplete | Not enforced at login; no flow sets `has_tfa`; lockout bug; GET send |
| Password recovery | Incomplete | Email path works; phone path no-op; enumeration; no session revocation |
| Account profile/password | Incomplete | Issues `tid: 0` tokens without role claims |
| Admin user CRUD | Incomplete | Create/update always fail validation; hard delete |
| Settings management | Incomplete | Browse filters/search broken; `/values` bypasses cache |
| Role management | Incomplete | Browse broken; deletion cascades users |
| Route-guard management | Incomplete | Browse filter broken; no unique constraint/index |
| Input sanitization/validation | Incomplete | XSS filter present; scalar uniqueness broken; some raw body use |
| Redis cache/pub-sub | Incomplete | Bcrypt per read/write; L1 has no TTL; no reconnect subscription |
| Unit tests | Existing | 34 files; coverage gaps for critical paths |
| Integration tests | Existing | 5 files; shared DB; no per-test isolation |
| Load tests | Existing | Artillery configs; not run for this report |
| Audit logging | Missing | No audit table or event taxonomy |
| Health/readiness | Missing | Only boot-time DB check; no HTTP probes |
| Metrics/tracing | Missing | No Prometheus/OpenTelemetry |
| OpenAPI contract | Missing | No machine-readable API spec |
| Background jobs/outbox | Missing | Email sent inline; no scheduled cleanup |
| Production container | Incomplete | Root user, dev tools, no `CMD`, no `.dockerignore` |
| CI quality gates | Incomplete | Tests only; no lint/build/audit/coverage/security |

### 3.4 What Works Well

These are real strengths and should be preserved:

1. **Parameterized SQL through Kysely.** I found no string-concatenated user input in queries. Identifier names in the validation helpers are allowlisted.
2. **Public column selection.** `UserRepository` uses an explicit `USER_PUBLIC_COLUMNS` list for API responses, reducing accidental password/hash exposure.
3. **LIKE wildcard escaping.** User, role, and setting search escape `%`, `_`, and `\`.
4. **Joi validation with `stripUnknown`.** Unknown fields are removed before controllers see them.
5. **Helmet, HPP, compression, disabled `x-powered-by`.** Good baseline HTTP hygiene.
6. **bcrypt with a pepper.** Passwords are not stored in plaintext; `SecurityUtil.hash` and `compare` use a server-side pepper.
7. **AES-256-GCM for cache payloads.** Authenticated encryption is the right primitive, even though the key handling and per-operation bcrypt are wrong.
8. **Database session records.** The intent to make JWTs revocable is correct; the implementation needs repair.
9. **Cursor pagination for users.** Keyset pagination on `id` is the right choice for a large user table.
10. **Boot-time DB check and worker shutdown.** The process fails fast when PostgreSQL is unavailable, and workers attempt to close the HTTP server and database pool.
11. **Existing tests cover many services and controllers.** The foundation is usable; the gaps are specific and fixable.
12. **Migrations are explicit and reviewable.** A static registry avoids filesystem discovery differences between ts-node, Vitest, and compiled output.

### 3.5 What Is Incomplete or Missing

The main gaps are:

- Correctness of validation, user administration, and account token issuance.
- Enforcement of session expiry, account status, and authorization freshness.
- Abuse controls and a coherent TFA policy.
- Atomicity and revocation in password recovery.
- Safe deletion semantics and data retention.
- Production configuration validation and safe CORS/secrets.
- Observability, auditability, health checks, and background jobs.
- CI quality gates, supply-chain scanning, and a production container.
- API documentation and contract testing.
- Test coverage for the exact paths that are broken.

### 3.6 Documentation vs. Code Discrepancies

| Documentation claim | Actual code | Impact |
| --- | --- | --- |
| README example uses `POST /api/v1/login` | Actual route is `POST /api/v1/auth/login` | Copy-paste failures |
| User browse comments/examples use `?limit=` | Middleware reads `per_page` | Pagination appears ignored |
| README says “Two-Factor Authentication Setup” | TFA is not enforced at login; no flow sets `has_tfa` | Overstates security posture |
| README says Redis caches “application settings and roles guard” | Redis is optional; cache falls back to DB; cache crypto can fail silently | Operational surprise |
| `compose.yml` image name contains `mysql` | Database is PostgreSQL | Misleading operations |
| README says “Production build” | Dockerfile is a development container; `build` cleans `build/` while output is `dist/` | Stale artifacts and unsafe deployment |
| `docs/testing/load-performance.md` describes thresholds | Configs exist, but load tests were not run for this report | Thresholds are intentions, not verified results |
| Setup notes say cluster workers default to CPU count | Absent `CLUSTER_WORKERS` parses to `0`, so the effective default is 1 worker; an empty value yields `NaN` | Unexpected capacity and zero-worker risk |

---

## 4. Current Implementation Assessment

### 4.1 Evidence Collected

| Check | How it was performed | Result |
| --- | --- | --- |
| Repository review | Read README, package/config, routes, middleware, services, repositories, migrations, seeds, tests, CI, Docker, compose | Completed |
| TypeScript typecheck | `tsc --noEmit` | Exit 0 |
| Lint | `npm run lint` | Exit 1: 140 problems (32 errors, 108 warnings). All 32 errors are under `.agents/skills/...` vendored JavaScript; application-source warnings remain |
| Migrations | `npm run db:migrate` | Exit 0 |
| Database connectivity | Boot-time `SELECT 1 + 1` check against configured `.env` | Connected |
| User-create validation probe | `userCreateSchema.validateAsync(...)` against the dev DB | Failed with `database.error (role_id)` |
| Register uniqueness probe | `registerSchema.validateAsync({username: "admin", ...})` | Accepted the duplicate username |
| Test suite | Not run for this report | Unknown current pass/fail state |
| Load tests | Not run for this report | No performance measurements |
| Security scans | Not run for this report | No SAST/DAST/dependency/container results |
| Benchmarks | Not run for this report | No latency/throughput measurements |

> The lint result needs context: the 32 errors are in vendored skill scripts, not in `src/`. That does not make the lint signal useless; it means the repository needs an ESLint ignore for `.agents/` (or a separate config) before lint can be a meaningful CI gate. The 108 warnings include application code and should be triaged rather than ignored.

### 4.2 Assessment Scorecard

| Area | Rating | Rationale |
| --- | --- | --- |
| Architecture | **Adequate** | Clear modular monolith; manual DI is understandable but duplicated wiring exists |
| Type safety | **Strong** | `strict: true`; Kysely schema types; explicit public columns |
| Input validation | **Weak** | Scalar uniqueness broken; role existence wrong; some raw body use; sanitizer semantics surprising |
| Authentication | **Critical** | Status ignored; session expiry ignored; lockout reset missing; TFA inconsistent; long-lived JWT |
| Authorization | **Weak** | Stale JWT claims; no route-guard seed; role deletion cascades users; admin bypass is powerful |
| Data integrity | **Weak** | Destructive FK cascade; hard delete; missing transactions; unique/FK errors become 500 |
| Performance | **Adequate/Weak** | Good indexes for user browse; bcrypt-per-cache-op; pool sizing and search indexing gaps |
| Testing | **Adequate** | Broad unit tests and five integration suites; critical paths and E2E/security/load gates missing |
| Observability | **Missing** | No request IDs, structured production logs, metrics, traces, health/readiness, or audit log |
| CI/CD | **Weak** | Tests only; no lint/typecheck/build/coverage/audit/security/image scan |
| Container/runtime | **Weak** | Root, dev tools, no `CMD`, no `.dockerignore`, no production build |
| Documentation | **Adequate but drifting** | Good README structure; endpoint and pagination examples are wrong; security claims overstate implementation |
| Overall production readiness | **Not ready** | P0 correctness and security defects must be closed first |

### 4.3 Strengths by Layer

**HTTP and middleware**

- Helmet, HPP, compression, `x-powered-by` disabled, user-agent parsing.
- JSON and URL-encoded body parsing.
- Centralized response helpers and error handler.
- Joi validation with `stripUnknown` and `abortEarly: false`.
- Request-level XSS filtering and pagination context.

**Application services**

- Business logic is separated from HTTP controllers.
- `catchAsync` ensures rejected promises reach the error middleware.
- Login includes a dummy bcrypt comparison to reduce timing-based username enumeration.
- Password recovery has resend cooldowns and attempt throttling.
- TFA OTP issuance uses a transaction and row lock to handle concurrent sends.

**Persistence**

- Kysely parameterization; no raw user-input SQL concatenation found.
- Explicit public column lists for user responses.
- `DatabaseExecutor` allows repositories to participate in transactions.
- Cursor pagination for users avoids `COUNT(*)` and deep offsets.
- Migrations include several browse indexes and check constraints.

**Security utilities**

- bcrypt with a pepper.
- Cryptographically secure random strings/numbers.
- AES-256-GCM with random 12-byte IV and auth tag.
- JWT verification rejects invalid/expired signatures.
- Password reset codes and OTPs are stored as bcrypt hashes.

**Testing**

- 34 colocated unit spec files and 5 integration suites.
- Integration tests exercise the real Express app through Supertest and a real PostgreSQL database.
- SendGrid is mocked in password-recovery tests.
- Artillery configs cover smoke, default, stress, and soak profiles.

### 4.4 Correctness Defects

The following defects are verified by code inspection and, where noted, by read-only probes.

| ID | Defect | Evidence | Impact | Priority |
| --- | --- | --- | --- | --- |
| C-01 | Scalar uniqueness validation is ineffective | `validateCompositeUnique` reads `value[column]`; Joi `.external()` passes a scalar. Probe: duplicate `admin` username accepted | Duplicate registration reaches DB and would fail with a generic 500; duplicate email/phone/username checks do not work | P0 |
| C-02 | Role existence validation queries a non-existent column | `validateCompositeUnique("roles", ["role_id"])`; probe returned `database.error (role_id)` | Admin user create and update always fail | P0 |
| C-03 | User update ignores the wrong ID | `user.routes.ts` passes `req.credentials.jwt.uid` as `ignoreId` instead of `req.params.id` | Uniqueness checks would exclude the acting admin, not the target user | P0 |
| C-04 | Session expiry is not checked | `AuthenticationTokenRepository.findById` filters only by `id` | Expired DB sessions remain valid while the JWT is valid | P0 |
| C-05 | Account changes mint `tid: 0` tokens without role claims | `AccountService.information/password` | Session checks are bypassed; authorization fails; logout cannot delete `tid: 0` | P0 |
| C-06 | Login ignores user status | `AuthenticationService.login` never checks `user.status` | Suspended/deactivated/pending users can authenticate | P0 |
| C-07 | Successful login does not reset lockout counters | No reset of `login_tries`/`failed_login_expired_at` on success | Earlier failures carry over; lockout can trigger earlier than intended | P1 |
| C-08 | TFA lockout is permanent | `tries >= 5` throws; `expired_tries_at` is never set; the existing-OTP update path does not reset `tries` | A token can be permanently unable to verify OTP | P0 |
| C-09 | TFA is not enforced and `has_tfa` is unused | Login always issues `tfa: false`; `tta_req` and `JWT_TFA` unused; no flow sets `has_tfa` | Users are either forced through an optional flow or can bypass the intended second factor | P0 |
| C-10 | Password reset is not atomic and does not revoke sessions | `updatePassword` then `deleteById` outside a transaction; no session deletion | Partial state; stolen sessions survive a password reset | P0 |
| C-11 | Password recovery leaks account existence | Response includes `next_resend_at` only for existing accounts; cooldown errors differ | Account enumeration | P1 |
| C-12 | Phone recovery is a no-op | `sendRecoveryNotification` returns for phone without sending | Users receive a success response but no code | P1 |
| C-13 | Email is sent inside a DB transaction | `sendRecoveryCode` wraps insert + SendGrid in `withTransaction` | Slow/failing email holds a DB connection and transaction | P1 |
| C-14 | Settings/roles/route-guard browse filters are broken | `numeric()` returns `0` when absent; `get()` returns `undefined`; comparisons to `null` are always true | Unintended `false`/`0` filters; `search.trim()` can throw | P1 |
| C-15 | `/settings/values` bypasses cache and requires auth | Controller calls `initializer()` directly; route uses `AuthenticationMiddleware()` only | Two DB queries per request; public values unnecessarily gated | P1 |
| C-16 | Email/phone changes do not reset verification flags | `UserRepository.update` updates values only | Verified contact data can be replaced without re-verification | P1 |
| C-17 | Role deletion cascades to users; user deletion is hard | `users_role_id_fk` uses `ON DELETE CASCADE`; `UserController.delete` calls `hardDelete` | A role deletion can destroy accounts; no audit trail/retention | P0 |
| C-18 | Seeds are non-idempotent and incomplete | Unconditional inserts; no route-guard seed; default `pass1234` | Re-running seeds fails; non-admin roles have no permissions | P1 |
| C-19 | Cluster worker count can be `NaN` | `parseInt("")` -> `NaN`; `Math.max(1, NaN)` -> `NaN` | `CLUSTER=true` with empty `CLUSTER_WORKERS` can start zero workers | P1 |
| C-20 | Build cleans the wrong directory | `build` runs `rimraf build`; `outDir` is `dist` | Stale compiled output can be shipped | P2 |
| C-21 | Database errors become generic 500s | No mapping for `23505`, `23503`, `23502`, `40001`, `40P01` | Duplicate/FK/not-null errors are opaque; clients cannot recover | P1 |
| C-22 | TFA validate uses raw `req.body.code` | Controller bypasses `req.sanitize.data` | Non-string/array input can cause 500; validated value is ignored | P2 |
| C-23 | User update allows `status: null` | Schema `.allow(null, "")`; DB column is `NOT NULL` | Not-null violation becomes 500 | P2 |
| C-24 | Request logging is minimal | Logs only method and URL | No status, latency, request ID, user, or error correlation | P1 |
| C-25 | Redis cache uses bcrypt per operation | `shield` hashes + encrypts; `unshield` decrypts + bcrypt-compares | Cache reads/writes are hundreds of milliseconds; cache is slower than DB | P1 |
| C-26 | L1 cache has no TTL and subscriptions only attach at boot | `localCache` never expires; `bootstrap` returns if Redis is offline | Stale settings/guards; Redis recovery does not restore subscriptions | P1 |
| C-27 | DB pool and timeouts are under-specified | Max 10 per worker; no `statement_timeout`/`lock_timeout` | Pool exhaustion and long-running queries can cascade | P1 |
| C-28 | Search uses leading wildcards without trigram indexes | `%keyword%` on six user columns; similar on roles/settings | Sequential scans at scale | P2 |
| C-29 | CI and container are not production-grade | Tests only; root container; no `.dockerignore`; no `CMD` | No quality gate; larger attack surface; unclear runtime | P1 |
| C-30 | Documentation drifts from code | Wrong login path; `limit` vs `per_page`; "MySQL" image name | Operational and integration mistakes | P2 |
| **C-31** | **`authentication_tokens` FK uses CASCADE** | Migration `20250313141555_authentication_tokens.ts` line 27: `onDelete("cascade")` | Deleting a user cascades to sessions; soft delete of user leaves orphaned sessions | P1 |
| **C-32** | **`two_factor_authentications` FK uses CASCADE** | Migration `20250313141609_two_factor_authentications.ts` line 14: `onDelete("cascade")` | Deleting a session cascades to TFA records; should be RESTRICT | P1 |
| **C-33** | **JWT algorithm not pinned** | `jsonwebtoken.verify` called without `algorithms: ['HS256']` | Algorithm confusion attacks possible | P1 |
| **C-34** | **No CORS preflight `maxAge`** | CORS config lacks `maxAge` | Preflight requests on every cross-origin call | P2 |
| **C-35** | **No CSP header** | Helmet defaults used; no CSP configured | XSS risk if HTML surface added later | P2 |
| **C-36** | **Password reset doesn't invalidate recovery tokens on account password change** | `AccountService.password` doesn't clean up `password_recoveries` | Stale recovery tokens can be used after password change | P1 |
| **C-37** | **No rate limit on `/auth/logout`** | Logout endpoint has no rate limiting | Session fixation / DoS risk | P1 |
| **C-38** | **SendGrid TLS verification not enforced** | Mail service doesn't verify server certificate | MITM on email delivery | P1 |
| **C-39** | **Cluster primary lacks signal handling** | `index.ts` workers handle SIGTERM/SIGINT but primary does not | Abrupt shutdown of all workers | P1 |
| **C-40** | **User browse uses `limit` param but middleware reads `per_page`** | Controller docs show `?limit=`; `request.middleware.ts` reads `per_page` | Pagination appears ignored; API mismatch | P2 |

### 4.5 Data Integrity and Transaction Assessment

**Good**

- Migrations define primary keys, unique constraints, foreign keys, check constraints, and several indexes.
- `UserRepository.updatePassword` accepts an optional transaction.
- TFA `issueOtp` uses a transaction, `FOR UPDATE`, and unique-violation handling.
- `incrementLoginTries` uses an atomic `login_tries + 1`.
- Password recovery uses a unique `(type, send_to)` constraint.

**Weak**

- Registration creates a user and then a session in separate operations. If session creation fails, the user exists but registration returns an error; a retry hits the unique constraint.
- Password reset updates the password and deletes the recovery row in separate operations.
- Role deletion uses `ON DELETE CASCADE` to users.
- User deletion is hard; `softDelete` exists but is unused.
- `route_guards` has no unique `(role_id, route)` constraint; duplicate permissions are possible.
- `users.status` accepts `NULL` through the update schema even though the column is `NOT NULL`.
- There is no outbox or idempotency mechanism for registration, recovery, or email delivery.
- There is no scheduled cleanup for expired sessions, recovery rows, or TFA rows. Session cleanup runs opportunistically during login and TFA verification.

### 4.6 Performance Assessment Summary

The schema has sensible indexes for the main user browse patterns. The largest performance problems are not missing indexes but:

- bcrypt inside every Redis cache read/write;
- L1 cache with no TTL and incomplete pub/sub recovery;
- `/settings/values` bypassing the cache with two DB queries per request;
- pool sizing that multiplies across cluster workers without PgBouncer;
- leading-wildcard search without trigram indexes;
- no statement/lock timeouts;
- email delivery inside a DB transaction.

These are detailed in Section 7.

### 4.7 Operational Assessment Summary

The process checks PostgreSQL at boot and workers attempt graceful shutdown. Beyond that, production operations are largely absent:

- No HTTP health/readiness endpoints.
- No request IDs or structured production logs.
- No log redaction.
- No metrics, traces, dashboards, or alerts.
- No audit log.
- No background job runner or outbox.
- No OpenAPI contract.
- No migration job strategy for multi-replica deployments.
- No backup/restore or disaster-recovery documentation.
- CI does not build, lint, typecheck, audit, scan, or measure coverage.
- The Docker image is a development environment, not a runtime image.

### 4.8 What Is Not a Problem (Avoid False Positives)

These points matter because they prevent wasted remediation effort:

1. **No SQL injection was found in the reviewed query paths.** Kysely parameterizes values; dynamic identifiers in `validateCompositeUnique` and `validateExists` are allowlisted with a strict regex. This does not remove the need for tests, but it is not a P0 injection finding.
2. **No N+1 pattern was found in the current repositories.** User browse, role browse, setting browse, and route-guard browse each use one query (route guards use one join). `SettingService.initializer()` intentionally runs two queries in parallel; the problem is that it bypasses cache, not that it is N+1.
3. **CSRF is not currently exploitable through the documented Bearer-token flow.** Browsers do not automatically attach `Authorization: Bearer` headers cross-site. If refresh tokens are later stored in cookies, CSRF protection becomes mandatory.
4. **The server-side XSS filter is not the primary XSS defense.** JSON APIs should rely on correct client-side output encoding and, for any HTML surface, CSP. The current sanitizer is defense-in-depth but can mutate legitimate input (including passwords containing `<`/`>`).
5. **bcrypt with a pepper is an acceptable password hash** when cost is adequate (OWASP suggests work factor 10+ for bcrypt; Argon2id is preferred for new systems). The problem is configuration validation and the 72-byte bcrypt input limit, not the primitive itself.
6. **JWT `alg: none` is rejected by `jsonwebtoken.verify` with a secret**, but algorithm pinning is still recommended to prevent algorithm-confusion classes of bugs.
7. **The migration system works.** `npm run db:migrate` exited 0. The issue is seed reliability and production migration strategy, not the presence of migrations.

### 4.9 Verification Boundaries

This assessment did **not** establish:

- That the current test suite passes.
- That the load-test thresholds are met.
- That there are no vulnerabilities beyond the reviewed code paths.
- That the database has no production-scale performance problems.
- That the Docker image builds or runs successfully.
- That the CI workflow passes on the current commit.

Those require execution in a controlled environment and should be part of the implementation plan, not assumed from static review.

---

## 5. Identified Gaps and Technical Debt

### 5.1 Gap Register

| ID | Area | Gap | Evidence | Impact | Priority |
| --- | --- | --- | --- | --- | --- |
| G-01 | Validation | Scalar uniqueness validator does not match Joi’s external value shape | `src/shared/validations/database/unique.ts` | Duplicate data and 500s | P0 |
| G-02 | Validation | Role existence uses `roles.role_id` | `user-create.schema.ts`, `user-update.schema.ts` | Admin user create/update unusable | P0 |
| G-03 | Validation | Wrong `ignoreId` on user update | `user.routes.ts` | Uniqueness checks target the wrong row | P0 |
| G-04 | AuthN | Account status is not enforced | `authentication.service.ts`, middleware | Suspended users retain access | P0 |
| G-05 | AuthN | Session expiry is not enforced | `authentication-token.repository.ts` | Revocation window is ineffective | P0 |
| G-06 | AuthN | Account tokens have `tid: 0` and no role claims | `account.service.ts` | Session bypass and broken authorization | P0 |
| G-07 | AuthN | Lockout counters are not reset on success | `authentication.service.ts` | Premature lockouts | P1 |
| G-08 | AuthN | TFA is not enforced; `has_tfa` unused | auth service, TFA service, settings | False sense of security | P0 |
| G-09 | AuthN | TFA lockout never expires | `two-factor-authentication.service.ts` | Permanent OTP lockout | P0 |
| G-10 | AuthN | No rate limiting on auth/recovery/OTP | No limiter middleware anywhere | Brute force, credential stuffing, email bombing | P0 |
| G-11 | Recovery | Password reset is non-atomic and does not revoke sessions | `password-recovery.service.ts` | Partial state; stolen sessions survive | P0 |
| G-12 | Recovery | Account enumeration via response shape | `password-recovery.controller.ts` | User discovery | P1 |
| G-13 | Recovery | Phone recovery sends nothing | `password-recovery.service.ts` | Broken feature | P1 |
| G-14 | Recovery | Email inside transaction | `password-recovery.service.ts` | DB pool pressure | P1 |
| G-15 | AuthZ | Authorization trusts stale JWT `rol`/`bpa` claims | `authorization.middleware.ts` | Role changes do not take effect until token expiry | P1 |
| G-16 | AuthZ | No route-guard seed; no unique/index on `(role_id, route)` | migrations, seeds | Non-admin roles have no permissions; duplicates possible | P1 |
| G-17 | Data | Role deletion cascades to users | users migration | Data loss | P0 |
| G-18 | Data | User deletion is hard; soft delete unused | `user.controller.ts`, repository | Loss of audit/history | P1 |
| G-19 | Data | Missing transactions for registration and password reset | services | Partial writes | P1 |
| G-20 | Data | DB errors are not mapped | `error.middleware.ts` | 500 instead of 409/400/503 | P1 |
| G-21 | Config | No environment validation; empty secrets accepted | `environment.ts` | Runtime failures and insecure deployments | P0 |
| G-22 | Config | CORS wildcard reflects any origin with credentials | `http.ts`, `.env.example` | Cross-origin data exposure risk | P0 |
| G-23 | Config | JWT lifetime 60 days; no `iss`/`aud`/`jti`/algorithm pinning | `.env.example`, `authentication-token.service.ts` | Long stolen-token window; ambiguous tokens | P1 |
| G-24 | Config | `CLUSTER_WORKERS=` yields `NaN`; cluster primary lacks signal handling | `index.ts` | Zero workers or abrupt shutdown | P1 |
| G-25 | Cache | bcrypt per Redis read/write | `security.util.ts`, `redis-cache.ts` | Cache slower than DB | P1 |
| G-26 | Cache | L1 no TTL; no re-subscribe after Redis recovery | services, bootstrap | Stale config/permissions | P1 |
| G-27 | Cache | `/settings/values` bypasses cache | `setting.controller.ts` | Two DB queries per request | P1 |
| G-28 | API | Settings/roles/route-guard browse filters are broken | controllers | Admin list endpoints fail or return wrong data | P1 |
| G-29 | API | No OpenAPI contract; pagination naming inconsistent | repo-wide | Integration friction | P2 |
| G-30 | DB | Pool sizing, statement/lock timeouts, PgBouncer not addressed | `database.ts` | Pool exhaustion under load | P1 |
| G-31 | DB | Search leading wildcards lack trigram indexes | repositories | Slow search at scale | P2 |
| G-32 | DB | No scheduled cleanup for sessions/recoveries/TFA | repo-wide | Table growth | P1 |
| G-33 | Ops | No request IDs, structured logs, redaction | logger/http | Poor incident response | P1 |
| G-34 | Ops | No health/readiness, metrics, traces | repo-wide | No reliable monitoring | P1 |
| G-35 | Ops | No audit log | repo-wide | No non-repudiation | P1 |
| G-36 | Ops | No background jobs/outbox | repo-wide | Inline email latency/failures | P1 |
| G-37 | Testing | No tests for the P0 defects; no E2E/security/load gates | test inventory | Regressions likely | P1 |
| G-38 | CI | No lint/typecheck/build/coverage/audit/security/image scan | workflow | Quality and supply-chain risk | P1 |
| G-39 | Container | Root, dev tools, no `CMD`, no `.dockerignore` | Dockerfile | Unsafe/large image | P1 |
| G-40 | Docs | Wrong endpoint and pagination examples | README | Integration mistakes | P2 |

### 5.2 Technical Debt Themes

#### TD-1: Validation abstraction mismatch

**Why it exists.** `validateCompositeUnique` was designed for composite object schemas but is attached to scalar fields. The tests cover the composite case with a mock DB, so the scalar case was never exercised against a real schema.

**Paydown.** Make the validator explicitly support both scalar and composite values. Add a scalar uniqueness test per real schema (`username`, `email`, `phone`). Replace role existence with `validateExists("roles", {column: "id"})`. Fix `ignoreId` at the route.

**Trigger to fix now.** Any admin user create/update or duplicate registration. This is P0.

#### TD-2: Split-brain token model

**Why it exists.** The application has two token-issuing paths: login/registration issues `tid > 0` with role claims, while account updates issue `tid: 0` without role claims. Middleware treats `tid: 0` as “no session check.”

**Paydown.** Define one token contract: every access token must carry a valid session ID, user ID, role/authorization version, and TFA state. Account updates should either keep the same session ID and refresh claims, or explicitly rotate the session. Remove the `tid: 0` bypass entirely.

**Trigger to fix now.** Any account profile/password change. This is P0.

#### TD-3: Authorization claims as the source of truth

**Why it exists.** Role slug and bypass flag are embedded in the JWT and trusted until expiry. There is no role/permission version or fresh lookup.

**Paydown.** Add a `role_version` or `permissions_version` to the user/role model and compare it during authentication, or resolve the current role from a cache with a short TTL. Add a unique `(role_id, route)` constraint and seed route guards. Keep the admin bypass explicit and auditable.

**Trigger.** Any role change, suspension, or permission change that must take effect before token expiry.

#### TD-4: Missing unit-of-work

**Why it exists.** Repositories accept `DatabaseExecutor`, but most services do not compose multi-step writes into a transaction. Registration, password reset, and role/status changes cross multiple statements.

**Paydown.** Add a small `withTransaction` helper or application-level unit-of-work. Wrap registration (user + session), password reset (password + recovery deletion + session revocation), and status/role changes (update + revoke sessions + audit). Map PostgreSQL error codes.

**Trigger.** Any partial-write bug or retry inconsistency.

#### TD-5: Cache crypto and consistency

**Why it exists.** The cache uses `SecurityUtil.shield`, which bcrypt-hashes the payload and AES-GCM-encrypts it. This provides integrity but at a very high CPU cost per cache operation. The L1 cache has no TTL, and subscriptions are attached only at boot.

**Paydown.** Use a KDF (HKDF-SHA-256) to derive a 32-byte AES key from a validated secret; use AES-GCM directly for confidentiality/integrity. Add TTL/versioning to L1, re-subscribe on Redis `ready`, and make cache failures observable. Do not use bcrypt for cache integrity.

**Trigger.** Any Redis-enabled deployment, especially at more than a few requests per second.

#### TD-6: Untyped configuration

**Why it exists.** `environment.ts` reads `process.env` with `parseInt`/string comparisons and no schema. Empty values become `""` or `NaN`; secrets are not required; `.env.example` contains unsafe defaults.

**Paydown.** Add a Joi (or equivalent) environment schema that validates required values, integer ranges, URL formats, secret lengths, and production-only constraints. Fail fast with a clear error. Remove dead variables (`JWT_TFA`, `CRYPTO_IV`) or implement them.

**Trigger.** Any deployment. This is P0.

#### TD-7: No request context or observability

**Why it exists.** Logging is a global Pino instance with `pino-pretty`, no request ID, no redaction, and only method/URL. There is no audit event model.

**Paydown.** Add `AsyncLocalStorage` request context, `pino-http` with request IDs, redaction paths, JSON output in production, health/readiness endpoints, Prometheus metrics, and OpenTelemetry traces. Add an append-only audit log for auth/admin events.

**Trigger.** Any production deployment or incident investigation.

#### TD-8: Test and CI gaps

**Why it exists.** Tests focus on happy paths and mocks. The global setup runs migrations only, so integration tests depend on a previously seeded database. CI runs tests only and does not run Redis.

**Paydown.** Add regression tests for every P0 defect, per-test transaction isolation, deterministic seed baseline, Redis service in CI, coverage thresholds, E2E auth flows, security tests, and load smoke tests. Add lint/typecheck/build/audit/CodeQL/image scan gates.

**Trigger.** Before merging the P0 fixes, so the fixes are locked in.

#### TD-9: Destructive defaults

**Why it exists.** `ON DELETE CASCADE` on `users.role_id`, hard deletes, weak seed password, 60-day JWT, wildcard CORS, and empty secrets are convenient for a boilerplate but dangerous in production.

**Paydown.** Replace destructive defaults with safe defaults: `ON DELETE RESTRICT`, soft delete by default, random/required seed credentials, short access tokens, CORS allowlist, required secrets. Document the development-only overrides.

**Trigger.** Any production deployment.

#### TD-10: Documentation drift

**Why it exists.** The README describes intended features, but some examples and claims do not match the implementation.

**Paydown.** Generate OpenAPI from the code or keep a hand-written spec in sync. Add executable examples and contract tests. Fix the login path and pagination parameter. Rename the compose image away from “mysql.”

**Trigger.** Before onboarding external integrators.

### 5.3 Debt Heat Map

| Area | Severity | Effort | Action |
| --- | --- | --- | --- |
| Auth/session/authorization invariants | Critical | Medium–High | Fix first; add regression tests |
| Validation and admin CRUD | Critical | Low–Medium | Fix first; low effort, high impact |
| Destructive data semantics | Critical | Low | Change FK, soft delete, guards |
| Password recovery/TFA | High | Medium | Atomicity, revocation, rate limits, policy |
| Configuration/CORS/secrets | High | Low–Medium | Schema validation and safe defaults |
| Cache crypto/consistency | High | Medium | Replace bcrypt integrity with KDF/AES-GCM; TTL/reconnect |
| DB performance/timeouts | High | Medium | Pool sizing, PgBouncer, indexes, timeouts |
| Observability/audit | High | Medium | Request context, logs, metrics, traces, audit |
| CI/container/supply chain | High | Medium | Quality gates, multi-stage image, scans |
| API contract/docs | Medium | Medium | OpenAPI, pagination standard |
| Advanced permissions/idempotency | Medium | High | Defer until triggered |
| SSO/passkeys/multi-tenancy | Low/product | High | Defer; not justified now |

### 5.4 What to Simplify or Delete

Avoid adding complexity while fixing the above. The following should be removed or consolidated:

- **Dead configuration:** `JWT_TFA` and `CRYPTO_IV` are parsed but unused. Either implement them or delete them.
- **Unused repository methods:** `softDelete` exists but is unused; either adopt it as the default deletion path or remove it until needed.
- **Duplicate wiring:** some route modules construct services directly while others use `container.ts`. Consolidate on the container or a per-module factory.
- **`validateCompositeUnique` for scalar fields:** replace with a dedicated scalar validator or make the existing one type-aware.
- **`build` script:** clean `dist`, not `build`.
- **`pino-pretty` in production:** use JSON output and pretty-printing only in development.
- **Development tools in the runtime image:** remove OpenCode, SSH configuration, `npm-check-updates`, and global nodemon from the production image.

### 5.5 Prioritization Rules

Use these rules when new work competes with the backlog:

1. **Security invariant or data-loss risk** → P0, regardless of feature value.
2. **Core workflow broken for an existing role** → P0/P1.
3. **Production operability gap that prevents detection or recovery** → P1.
4. **Performance issue with a measured or obvious bottleneck** → P1/P2 depending on scale.
5. **New product capability** → P2/P3 unless it unlocks revenue or compliance.
6. **Architecture rewrite** → reject unless the current architecture cannot satisfy a concrete requirement.

---

## 6. Security Assessment

### 6.1 Method and Scope

This assessment is a **static code review** mapped to:

- OWASP Top 10:2025.
- OWASP API Security Top 10:2023.
- OWASP Application Security Verification Standard (ASVS) 5.0.
- OWASP Password Storage Cheat Sheet.
- NIST SP 800-63B-4 (Digital Identity Guidelines: Authentication and Lifecycle Management).
- JWT Best Current Practices (RFC 8725).

No dynamic application security testing (DAST), penetration test, dependency audit, container scan, or fuzzing was executed. Severity reflects code-level exploitability and impact, not a validated exploit.

### 6.2 Threat Model

| Element | Assumption |
| --- | --- |
| Exposure | Internet-facing REST API behind TLS termination and, ideally, a reverse proxy/WAF |
| Authentication | Bearer JWT in the `Authorization` header; database-backed session row |
| Roles | `admin` (bypass authorization), `manager`, `customer`; route strings grant permissions |
| Assets | Passwords, sessions, PII (name, email, phone, address), role/route configuration, settings, OTP/recovery codes |
| Trust boundaries | Client → API; API → PostgreSQL; API → Redis; API → SendGrid; admin → user data |
| Attacker capabilities | Credential stuffing, password guessing, token theft/replay, account enumeration, request flooding, malformed input, dependency compromise |
| Out of scope | Host/OS compromise, cloud control-plane compromise, physical access, insider threats (partially covered by audit logging) |

### 6.3 Security Findings

| ID | Severity | Finding | OWASP / API / ASVS | Evidence | Remediation | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| S-01 | **Critical** | Session revocation bypass via `tid: 0` tokens | A01, A07 / API2 / V7 | `AccountService.information/password`; middleware skips `tid > 0` check | One token contract; every access token must reference a live session; remove `tid: 0` bypass | P0 |
| S-02 | **High** | Expired database sessions remain valid | A07 / API2 / V7 | `AuthenticationTokenRepository.findById` lacks `expired_at` predicate | Enforce `expired_at > now()` and `user_id = uid`; add regression tests | P0 |
| S-03 | **High** | Suspended/deactivated users can log in and keep using tokens | A07 / API2 / V6 | `AuthenticationService.login` never checks `status`; middleware never checks status | Check status at login and per request (or revoke sessions on status change) | P0 |
| S-04 | **Critical** | Role deletion cascades to users | A01, A06 / API5 / V8 | `users_role_id_fk ... onDelete("cascade")` | `ON DELETE RESTRICT`; guard system roles; require reassignment | P0 |
| S-05 | **High** | No rate limiting on login, registration, recovery, or OTP | A07 / API2, API4 / V6, V2 | No limiter middleware in `src/` | Redis-backed per-IP + per-account limits; progressive delays; CAPTCHA where appropriate | P0 |
| S-06 | **High** | TFA is not enforced; no flow sets `has_tfa` | A07 / API2 / V6 | Login always `tfa: false`; `tta_req`/`JWT_TFA` unused; `has_tfa` never updated | Define and enforce a TFA policy; enrollment flow; set `has_tfa`; gate account routes consistently | P0 |
| S-07 | **High** | TFA lockout is permanent | A07 / API2 / V6 | `tries >= 5` throws; `expired_tries_at` never set; the existing-OTP update path does not reset tries | Set `expired_tries_at` on threshold; reset tries on new OTP; rate-limit OTP sends | P0 |
| S-08 | **High** | Password reset does not revoke sessions | A07 / API2 / V7 | `resetPassword` updates the password and deletes the recovery row, but deletes no sessions | Delete all sessions in the same transaction; reset lockout counters | P0 |
| S-09 | **High** | Authorization trusts stale JWT `rol`/`bpa` claims | A01 / API1, API5 / V8 | `authorization.middleware.ts` reads claims only | Role/permission version or fresh cache lookup; revoke on role change; short access tokens | P1 |
| S-10 | **High** | CORS reflects any origin with credentials | A02 / API8 / V13 | `origin: true` when `CORS_ORIGINS=*` or empty; `credentials: true` | Explicit allowlist; reject wildcard with credentials; environment-specific origins | P0 |
| S-11 | **Critical** | Required secrets are not validated | A02, A04 / API8 / V13, V11 | Empty `JWT_SECRET`, `BCRYPT_SECRET`, `CRYPT0_SECRET` accepted at boot | Startup schema validation; secret manager; length/format checks; fail fast | P0 |
| S-12 | **High** | JWT is long-lived and lacks standard claims/algorithm pinning | A07, A04 / API2 / V9 | 60-day example; no `iss`/`aud`/`jti`; no `algorithms` option | Short access token + rotating refresh; `iss`/`aud`/`jti`; pin HS256 or move to asymmetric keys | P1 |
| S-13 | **Medium** | Account enumeration through password recovery | A07 / API2 / V6 | `next_resend_at` only present for existing accounts; cooldown errors differ | Constant response shape/timing; generic cooldown behavior; rate limit | P1 |
| S-14 | **Medium** | PII/secrets may be logged | A09 / API8 / V16 | `logger.error("Unhandled...", err)` logs full error; no redaction | Structured logs with redaction paths; never log tokens/passwords/codes/SQL params | P1 |
| S-15 | **Medium** | No audit trail for security/admin events | A09 / API8 / V16 | No audit table/events | Append-only audit log: login, logout, failed login, password reset, role/status change, user/role/setting deletion | P1 |
| S-16 | **Medium** | Email/phone verification is not implemented | A07 / API2 / V6 | `is_email_verified`/`is_phone_verified` exist but are never set by a verification flow | Verification tokens, expiry, resend limits, verify endpoints, reset flags on change | P1 |
| S-17 | **Medium** | State-changing operations use GET | A02 / API8 / V4, V13 | Resolved: GET aliases removed | Use POST; if cookies are introduced, add CSRF protection | P1 |
| S-18 | **Medium** | Hard delete and no retention policy | A01, A09 / API5 / V8, V14 | `hardDelete` for users/settings/roles/route guards; `softDelete` unused | Soft delete users by default; retention/erasure policy; audit; restrict destructive admin actions | P1 |
| S-19 | **Medium** | Database errors become generic 500s | A10 / API8 / V16 | No mapping for `23505`, `23503`, `23502`, `40001`, `40P01` | Typed error mapping; return 409/400/503; keep internal details out of responses | P1 |
| S-20 | **Medium** | Supply chain controls are missing | A03, A08 / API8, API10 / V13, V15 | CI uses action tags, no audit/CodeQL/image scan/SBOM | `npm audit`, CodeQL, dependency review, pinned action SHAs, image digest, Trivy, SBOM, signing | P1 |
| S-21 | **Medium** | Redis cache crypto is expensive and weakly validated | A04 / API8 / V11 | `shield` bcrypt-hashes each cache payload; 32-byte key not validated | HKDF-derived AES-256-GCM key; validate key length; no bcrypt for cache integrity | P1 |
| S-22 | **Medium** | Route guards lack uniqueness and a `role_id` index | A01 / API5 / V8 | `route_guards` migration | Unique `(role_id, route)`; index `role_id`; seed canonical routes; tests | P1 |
| S-23 | **High in production** | Seed accounts use a weak shared password | A07 / API2 / V6 | `securityUtil.hash("pass1234")` | Require a seed password env var or generate a random one; refuse weak/default passwords in production | P1 |
| S-24 | **Medium** | Coarse role checks lack object/field-level authorization | A01 / API1, API3 / V8 | Route guards authorize a route, not a record; user update allows `role_id`/`status` | Add ownership/tenant checks where needed; field-level authorization for privileged fields; tests | P2 |
| S-25 | **Low/Medium** | Password policy diverges from modern guidance | A07 / API2 / V6 | 8–32 chars with composition rules | Min 12–15, max 64+, allow spaces/Unicode, breached-password screening, no forced rotation; handle bcrypt's 72-byte limit | P2 |
| S-26 | **Low** | XSS sanitizer can mutate secrets and is not output encoding | A05 / API8 / V2 | `request.middleware.ts` sanitizes all strings, including passwords | Do not sanitize password fields; validate instead; rely on output encoding/CSP for HTML surfaces | P2 |
| S-27 | **Low** | TFA validate reads raw `req.body.code` | A05 / API8 / V2 | Controller bypasses `req.sanitize.data` | Use validated data; enforce string/length; add tests | P2 |
| **S-28** | **High** | `authentication_tokens` FK uses CASCADE | A01, A06 / API5 / V8 | Migration `20250313141555` line 27: `onDelete("cascade")` | `ON DELETE RESTRICT`; soft delete user should not cascade to sessions | P1 |
| **S-29** | **High** | `two_factor_authentications` FK uses CASCADE | A01, A06 / API5 / V8 | Migration `20250313141609` line 14: `onDelete("cascade")` | `ON DELETE RESTRICT`; session deletion should not cascade to TFA records | P1 |
| **S-30** | **High** | JWT algorithm not pinned | A04 / API2 / V9 | `jwt.verify` called without `algorithms: ['HS256']` | Pin algorithm in `jwt.verify` options; reject `alg: none` and algorithm confusion | P1 |
| **S-31** | **High** | No rate limit on `/auth/logout` | A07 / API4 / V6 | Logout endpoint has no rate limiting | Add to rate-limiter scope (F-06) | P1 |
| **S-32** | **Medium** | SendGrid TLS verification not enforced | A02 / API8 / V13 | Mail service uses default TLS without cert verification | Set `rejectUnauthorized: true` for SendGrid client | P1 |
| **S-33** | **High** | Cluster primary lacks signal handling | A09 / V16 | `index.ts` primary process has no SIGTERM/SIGINT handler | Add signal handlers to primary; forward to workers | P1 |
| **S-34** | **Medium** | Password change doesn't invalidate recovery tokens | A07 / API2 / V7 | `AccountService.password` doesn't clean up `password_recoveries` | Delete recovery tokens on password change (F-08) | P1 |
| **S-35** | **Medium** | No CSP header | A05 / API8 / V14 | Helmet defaults used; no CSP configured | Add restrictive CSP for JSON API | P2 |

### 6.4 Authentication Deep Dive

#### Password handling

**Current state**

- bcrypt with a server-side pepper (`plain + "." + pepper`).
- Salt rounds default to 10; `.env.example` sets 12.
- Password schema: 8–32 characters, at least one uppercase, lowercase, digit, and special character.
- Registration and account password changes enforce the schema; login accepts any string.
- Passwords are sanitized by the global XSS filter before validation.

**Assessment**

bcrypt with a pepper is acceptable, but the policy is dated. NIST SP 800-63B-4 emphasizes length over composition, recommends allowing at least 64 characters, supports spaces and Unicode, and recommends screening against breached-password lists. The current 32-character maximum is unnecessarily low, and the composition rules encourage predictable patterns such as `Password1!`. bcrypt also has a 72-byte input limit; a 64-character Unicode password can exceed it unless pre-hashed or capped deliberately.

**Recommendation**

- Minimum 12 characters (15 for password-only accounts), maximum at least 64.
- No composition rules; allow all printable characters and spaces.
- Screen new passwords against a breached-password corpus (offline list or a privacy-preserving API).
- Do not force periodic rotation; rotate on compromise.
- Keep bcrypt cost at 12+ or migrate to Argon2id (OWASP’s first choice) with a versioned hash format.
- Never sanitize password input; validate length/encoding and hash the raw value.
- Add a password-change audit event and revoke other sessions on change.

#### Lockout and throttling

**Current state**

- Per-account `login_tries` and `failed_login_expired_at`.
- On failure, increments tries; at `mx_log_try` sets a lockout for `lck_prd` minutes.
- On lockout expiry, resets counters before comparing the password.
- No reset on successful login.
- No IP/global/device rate limit.
- No rate limit on registration, recovery, or OTP.
- TFA has a separate tries counter, but its lockout is permanent.

**Assessment**

Per-account lockout alone is both insufficient and abusable: an attacker can lock out arbitrary users, while distributed credential stuffing across many accounts is unaffected. Successful-login reset is missing, so legitimate users can be locked out earlier than intended. TFA’s permanent lockout is a denial-of-service bug.

**Recommendation**

- Add layered limits: per IP, per account, per device/session, and global auth endpoint limits.
- Use progressive delays and short windows, not indefinite lockouts.
- Reset counters on successful authentication.
- Set `expired_tries_at` when the TFA threshold is reached; reset tries when a new OTP is issued.
- Rate-limit OTP sends and password-recovery sends separately.
- Consider CAPTCHA or proof-of-work after repeated failures.
- Log rate-limit events for detection.

#### Account status

**Current state**

- `users.status` supports `Activated`, `Suspended`, `Deactivated`, `Pending`.
- Login does not check status.
- Middleware does not check status.
- Admin update can change status, but does not revoke sessions.
- Account information update requires status `Activated`; a suspended user gets a 500 from `AccountService.information`.

**Recommendation**

- Reject authentication unless status is `Activated` (or explicitly allowed, e.g., `Pending` for limited onboarding).
- On status change, revoke all sessions in the same transaction.
- Optionally include a `status_version` or `session_version` in the token and compare it per request.
- Return a generic “account unavailable” message to avoid leaking status details.

#### Multi-factor authentication

**Current state**

- Email OTP, 6 digits, bcrypt-hashed, 5-minute expiry, 2-minute resend cooldown.
- Login always issues `tfa: false`.
- `/auth/tfa/send` is allowed when `tfa` is false; `/auth/tfa/validate` returns a token with `tfa: true`.
- `/account/*` unconditionally requires `tfa: true`.
- No flow sets `has_tfa`; `tfa_secret` is unused by any flow; `tta_req` and `JWT_TFA` are unused.
- OTP send is a GET.
- TFA lockout is permanent.

**Assessment**

The pieces exist, but there is no coherent policy. A fresh login cannot access account routes until it completes TFA, even if the user never enrolled. Conversely, login itself does not require TFA, so the second factor is optional for normal API use. This is worse than either “TFA off” or “TFA enforced”: it creates a false sense of security and a confusing UX.

**Recommendation**

- Choose one policy:
  - **Global:** `tta_req` requires TFA for all users; login returns a restricted token until TFA completes.
  - **Per-user:** `has_tfa` requires TFA; users can enroll/disable with re-authentication.
- Return an explicit `tfa_required` flag or a token with a narrow scope; never let a restricted token access protected resources.
- Set `has_tfa` on successful enrollment, not on every login.
- Use POST for send/validate.
- Rate-limit sends and attempts; set `expired_tries_at`; reset on new OTP.
- Prefer TOTP or WebAuthn for stronger factors; email OTP is acceptable as a possession factor but inherits email account risk.
- Add recovery codes and an admin reset procedure.

#### Sessions and logout

**Current state**

- Session row per login/registration.
- JWT contains `uid`, `tid`, `tfa`, `rol`, `bpa`.
- Logout deletes the current session.
- No logout-all.
- `ip`, `browser`, `os` columns exist but are always null at login (see `authentication.service.ts` lines 59-61, 143-145).
- No refresh token.
- No session listing/management.
- No scheduled cleanup.
- `expired_at` is set but not checked on use (`findById` lacks `expired_at` filter).
- `tid: 0` bypasses session checks.
- FK `authentication_tokens.user_id` uses `ON DELETE CASCADE` (should be RESTRICT for soft delete).

**Recommendation**

- Short-lived access token (10–15 minutes) plus rotating refresh token (7–30 days).
- Store refresh tokens hashed; rotate on every use; detect reuse and revoke the family.
- Populate IP/user-agent metadata at login for audit and anomaly detection.
- Add `logout-all` and session listing/revocation.
- Revoke sessions on password change, status change, role change (if permissions change), and suspected compromise.
- Add `jti`, `iss`, `aud`, and `kid`; pin algorithms (`HS256`); plan key rotation.
- Clean up expired sessions on a schedule, not only at login.
- Change FK to `ON DELETE RESTRICT` to support soft delete pattern.

### 6.5 Authorization Deep Dive

**Current model**

- `roles` table with `slug` and `is_bypass_authorization`.
- `route_guards` maps `role_id` to route strings.
- Login embeds `rol` (role slug) and `bpa` (1 for bypass) in the JWT.
- `AuthorizationMiddleware(route)` loads the route-guard cache and checks whether `guards[role]` includes the route.
- Admin bypass returns `next()` immediately.
- Missing credentials/role/cache returns 403 (deny-by-default).

**Strengths**

- Deny-by-default for missing guards.
- Route strings are explicit and reviewable.
- Cache avoids a DB join per request.
- Admin bypass is a single, auditable flag (in principle).

**Weaknesses**

- No route-guard seed means non-admin roles have no permissions by default.
- No unique `(role_id, route)` constraint; duplicate grants are possible.
- No index on `role_id`; the full-table join used to build the cache can degrade.
- JWT claims are trusted until expiry; role changes are delayed.
- `bpa` is a powerful claim; a stolen admin token has full access until expiry.
- No object-level authorization: a role granted `users:view` can view every user.
- No field-level authorization: a role granted `users:update` can change `role_id`, `status`, and password.
- No permission version or audit of permission changes.
- No tests that assert the full route/role matrix.
- FK `route_guards.role_id` uses `ON DELETE CASCADE` (migration `20251023075024_route_guards.ts`).

**Recommendation**

- Keep route guards for coarse-grained access, but add:
  - unique `(role_id, route)` and index on `role_id`;
  - a seeded canonical route list per role;
  - a permission version or fresh role lookup;
  - object-level checks for user-owned resources;
  - field-level checks for privileged fields.
- Add an authorization matrix test that logs in as each role and asserts allowed/denied routes.
- Log authorization denials with actor, route, role, and request ID.
- Consider a normalized `permissions` model only if route strings become unmanageable (P2).

### 6.6 Token and Session Deep Dive

| Property | Current | Recommended |
| --- | --- | --- |
| Access token lifetime | 60 days in `.env.example`; 7 days default in code | 10–15 minutes |
| Refresh token | None | Rotating, hashed at rest, 7–30 days |
| Revocation | Delete session row; `tid: 0` bypasses | Every token references a live session; revocation checked per request |
| Expiry check | JWT only; DB `expired_at` ignored | JWT + DB expiry + user status |
| Claims | `uid`, `tid`, `tfa`, `rol`, `bpa` | Add `iss`, `aud`, `jti`, `iat`, `nbf`, version/kid |
| Algorithm | Library default with shared secret | Pin `HS256` or use asymmetric `EdDSA`/`RS256` with `kid` |
| Storage | Response body; client-defined | Memory for access token; `HttpOnly; Secure; SameSite` cookie for refresh, with CSRF protection |
| Session metadata | `ip`/`browser`/`os` always null | Populate at login; show in session list |
| Logout | Current session only | Current + all sessions |
| Cleanup | Opportunistic purge on login/TFA; no schedule | Scheduled job + index |

**JWT guidance**

- Use `iss` and `aud` and verify both.
- Add `jti` for traceability and replay detection.
- Pin the accepted algorithm in `jwt.verify`.
- Use a secret of at least 32 random bytes; store it in a secret manager; support rotation with `kid`.
- Do not put sensitive data in the payload; JWT payloads are readable.
- Keep access tokens short-lived; do not rely on revocation alone.

### 6.7 Input, Output, and Injection

**SQL injection**

No SQL injection was found in the reviewed paths. Kysely parameterizes values. `validateCompositeUnique`/`validateExists` allowlist table/column identifiers with `/^[a-zA-Z0-9_]+$/`. This should be preserved and tested. Do not introduce raw SQL with user-controlled identifiers.

**XSS**

The API returns JSON. The global `xss` filter strips HTML from body/query strings. This is defense-in-depth, not a substitute for client-side output encoding. It also mutates passwords and other values that should be treated as opaque. Recommendation: do not sanitize password fields; validate them; use CSP and output encoding on any HTML surface (admin UI, docs, emails).

**Mass assignment**

Controllers use `req.sanitize.data`, which is built from an explicit field list and Joi `stripUnknown`. This is good. However, `userUpdateSchema` allows `role_id`, `status`, and `password`; any role with `users:update` can change them. Add field-level authorization if non-admin roles ever receive this permission.

**Error handling**

`errorHandler` returns generic 500s for unknown errors, which avoids leaking stack traces. However, it logs the full error object, and database unique/FK violations become 500s. Add typed error mapping and redaction.

**Request size and content type**

`express.json()` uses the default 100 KB limit. Set an explicit limit appropriate to the API, reject unsupported content types where relevant, and keep `urlencoded({extended: true})` only if needed.

**Log injection**

Method and URL are logged directly. Structured logging with escaped fields is safer. Do not log raw query strings if they can contain tokens or PII.

### 6.8 Configuration and Transport Security

| Control | Current | Recommendation |
| --- | --- | --- |
| CORS | `origin: true` with credentials when `*`/empty | Explicit allowlist; never `*` with credentials; per-environment |
| Helmet | Default headers | Add HSTS, CSP (for HTML surfaces), referrer policy, permissions policy |
| TLS (DB) | Optional; `rejectUnauthorized` defaults true | Require TLS in production; validate CA; least-privilege DB user |
| TLS (Redis) | Optional; `rejectUnauthorized` only in production | Require TLS + auth in production; validate CA |
| Secrets | Empty values accepted | Startup validation; secret manager; rotation |
| Proxy trust | `HAS_PROXY` toggles `trust proxy` | Set correctly behind the actual proxy; otherwise `req.ip` is wrong |
| Body limits | Default 100 KB | Explicit limit; reject oversized payloads |
| State-changing GET | Logout/TFA send | POST |
| Security headers | Helmet defaults | Tune for API vs HTML; add HSTS in production |

### 6.9 Abuse and Resource Consumption

| Vector | Current exposure | Control |
| --- | --- | --- |
| Credential stuffing | No IP/global limit; per-account lockout only | Per-IP + per-account + device limits; breached-password screening; MFA |
| Password guessing | bcrypt cost helps, but no rate limit | Progressive delays; CAPTCHA; alerting |
| Account lockout DoS | 5 failures can lock a known account | Short lockouts; IP reputation; avoid indefinite lockout |
| OTP brute force | 6 digits; 5 tries but permanent lockout bug | Rate limit; set expiry; reset on new OTP; alert |
| Recovery email bombing | 2-minute resend per account; no IP limit | Per-IP + per-target limits; CAPTCHA; monitoring |
| Registration spam | No limit/CAPTCHA/verification | Rate limit; email verification; disposable-email blocking if needed |
| Expensive bcrypt DoS | Login/register/recovery/TFA; cache bcrypt | Rate limits; cache KDF redesign; capacity planning |
| DB pool exhaustion | Email inside transaction; no statement timeout | Outbox; timeouts; PgBouncer; pool sizing |
| Large payloads | Default 100 KB | Explicit limit; reverse-proxy limits |
| Slowloris | Node/Express defaults | Reverse-proxy timeouts; `server.headersTimeout`/`requestTimeout` |

### 6.10 Logging, Monitoring, and Audit

**Current state**

- Pino with `pino-pretty` always, including production.
- Request log: method + URL only.
- No request ID, status, latency, user, or correlation.
- `console.error` in validators/services.
- Error middleware logs the full error object.
- No audit log.
- No metrics/traces/alerts.

**Risks**

- Incident detection is slow.
- Forensic reconstruction is impossible.
- Sensitive data can leak into logs.
- Rate-limit and authorization failures are invisible.

**Recommendation**

- `pino-http` with request ID, method, route, status, latency, user ID (when authenticated), and error code.
- Redact `authorization`, `cookie`, `set-cookie`, `password`, `new_password`, `current_password`, `code`, `token`, `refresh_token`, and secret-like keys.
- JSON logs in production; pretty logs in development only.
- Audit events for authentication, authorization failures, password changes, role/status changes, deletions, and settings changes.
- Metrics: request rate, error rate, latency histogram, auth failures, rate-limit hits, DB pool usage, query latency, cache hit ratio, Redis errors.
- Traces: HTTP spans, DB spans, Redis spans, email spans.
- Alerts: error rate, p95 latency, auth failure spike, pool exhaustion, Redis down, disk/backup failures.
- Retention and access control for logs/audit.

### 6.11 Supply Chain and Dependency Security

**Current state**

- `package-lock.json` is used by `npm ci` (good).
- Dependencies use caret ranges; lockfile pins resolved versions.
- CI actions use tags (`actions/checkout@v4`, `actions/setup-node@v4`), not commit SHAs.
- No `npm audit`, CodeQL, dependency review, secret scanning, container scan, SBOM, or image signing.
- Docker base is `ubuntu:26.04` without a digest.
- No Dependabot/Renovate configuration observed.

**Recommendation**

- Run `npm audit --omit=dev` (and full audit for dev) in CI; fail on high/critical with a documented exception process.
- Enable CodeQL or Semgrep for TypeScript.
- Enable dependency review on pull requests.
- Pin GitHub Actions to full commit SHAs.
- Pin container base images by digest; use a minimal runtime image.
- Generate an SBOM (CycloneDX) and scan with Trivy/Grype.
- Sign images with cosign/Sigstore; verify signatures at deploy.
- Use Dependabot/Renovate with grouped, tested updates.
- Review transitive dependencies and license obligations.

### 6.12 Positive Security Controls to Preserve

- Helmet and HPP.
- Explicit CORS configuration (fix the default, keep the mechanism).
- Parameterized Kysely queries and identifier allowlists.
- Joi validation with `stripUnknown`.
- bcrypt with pepper; AES-256-GCM.
- JWT signature verification and generic auth errors.
- Password reset/OTP codes stored as bcrypt hashes.
- Resend cooldowns and attempt counters (fix the bugs, keep the intent).
- TFA `issueOtp` transaction/row lock.
- Public column selection for user responses.
- Generic 500 response body (do not add stack traces).
- Database health check at boot.

### 6.13 Security Acceptance Criteria

Before production, all of the following should be true:

- [ ] Every access token references a live, unexpired session; `tid: 0` bypass removed.
- [ ] Suspended/deactivated users cannot authenticate or use existing tokens.
- [ ] Password/status/role changes revoke affected sessions atomically.
- [ ] Login, registration, recovery, and OTP endpoints are rate-limited per IP and per account.
- [ ] TFA policy is explicit, enforced, and tested; `has_tfa` is accurate.
- [ ] Password reset is atomic, non-enumerating, and revokes sessions.
- [ ] Role deletion cannot delete users; destructive admin actions require confirmation/audit.
- [ ] CORS uses an explicit allowlist; wildcard + credentials is rejected.
- [ ] Required secrets are validated at boot and stored outside the repo.
- [ ] JWT lifetime is short; refresh rotation/reuse detection is implemented.
- [ ] Authorization uses fresh role/permission state or a version check.
- [ ] Route guards have a unique constraint, index, seed, and matrix tests.
- [ ] No critical/high SAST/DAST/dependency/container findings.
- [ ] Audit logs cover authentication and admin events; logs are redacted.
- [ ] TLS is enforced for DB/Redis in production; DB user is least-privilege.
- [ ] Backups are encrypted and a restore drill has passed.
- [ ] Security headers, body limits, and proxy trust are configured for the deployment.
- [ ] An incident-response runbook and security contact exist.

### 6.14 CSRF, XSS, and SSRF Clarifications

- **CSRF:** The documented flow uses `Authorization: Bearer`, which browsers do not attach automatically. CSRF is therefore not a current primary risk. If refresh tokens move to cookies, add `SameSite`, `Secure`, `HttpOnly`, origin checks, and a maintained CSRF token mechanism.
- **XSS:** JSON responses are not rendered as HTML by the API. Client applications must encode output. The server-side sanitizer is not sufficient for rich HTML and can corrupt passwords; use it selectively.
- **SSRF:** The current code does not fetch user-supplied URLs. SendGrid is a fixed outbound integration. If webhooks, image imports, or URL previews are added, enforce allowlists, block private/link-local ranges, and set timeouts.

---

## 7. Performance and Database Assessment

### 7.1 Method and Caveats

This section is based on schema inspection, query review, and configuration review. **No benchmarks, query plans, load tests, or production metrics were collected.** Statements such as “sequential scan” describe likely planner behavior at scale, not measured plans. Any performance claim should be validated with `EXPLAIN (ANALYZE, BUFFERS)` and load tests on representative data.

### 7.2 Schema and Index Inventory

| Table | Indexes / constraints | Coverage assessment |
| --- | --- | --- |
| `settings` | PK; unique `name`, `slug` | Small table; browse filters lack indexes but table is likely small |
| `roles` | PK; unique `slug`; index `created_at` | Browse by `is_public`/search may scan; small table |
| `users` | PK; unique `phone`, `email`, `username`; browse indexes `(deleted_at, role_id, status, id)`, `(deleted_at, status, id)`, `(deleted_at, role_id, id)`, `(deleted_at, id)` | Good for filtered cursor browse; no trigram index for leading-wildcard search |
| `authentication_tokens` | PK; FK `user_id`; indexes `user_id`, `expired_at`, `created_at` | Good for session lookup by PK and purge by user/expiry; cleanup query can use bitmap AND; **FK uses CASCADE** |
| `two_factor_authentications` | PK; unique `token_id`; index `(token_id, expired_at)` | Good for lookup by token; **FK uses CASCADE** |
| `password_recoveries` | PK; unique `(type, send_to)`; indexes `(type, send_to)`, `next_resend_at`, `expired_at`, `next_try_at` | Good for recovery lookup and cleanup |
| `route_guards` | PK; FK `role_id`; **no index on `role_id`**; **no unique `(role_id, route)`** | Full join for cache build; duplicates possible; index needed as table grows |

### 7.3 Query Pattern Review

| Operation | Query shape | Assessment |
| --- | --- | --- |
| Login | `users` by `username` (unique), role by PK, purge expired sessions by `user_id` + `expired_at`, insert session | Indexed; bcrypt dominates latency |
| Authenticated request | `authentication_tokens` by PK | Indexed; should also check `expired_at` and `user_id` |
| User browse | `users` filtered by `deleted_at`, optional `role_id`/`status`, `id < cursor`, order `id desc`, limit | Good composite indexes; search adds leading-wildcard predicates |
| User view | `users` by PK + `deleted_at is null` | Indexed |
| Settings values | Two queries (`is_public=false`, `is_public=true`) with `is_disabled=false` | Small table but should be cached; currently bypassed |
| Route-guard cache build | Join `route_guards` + `roles`, full result set | Fine for small tables; add `role_id` index; cache |
| Password recovery send | `users` by email/phone; `password_recoveries` by `(type, send_to)`; delete + insert in transaction | Indexed; email call inside transaction |
| TFA verify | `two_factor_authentications` by `token_id`; update tries; delete | Indexed; bcrypt compare per attempt |
| Role/setting browse | Offset pagination with optional filters | Fine for small admin tables; deep offsets degrade |
| Route-guard browse | Join + optional `role_id` filter + offset | No `role_id` index; filter bug makes it worse |

### 7.4 Performance Findings

| ID | Finding | Impact | Priority |
| --- | --- | --- | --- |
| P-01 | Redis cache uses bcrypt per `get`/`set` via `shield`/`unshield` | Cache operations cost hundreds of milliseconds; cache can be slower than the DB and burns CPU | P1 |
| P-02 | L1 cache has no TTL; Redis subscriptions attach only at boot | Stale settings/route guards; after Redis recovery, no cache invalidation | P1 |
| P-03 | `/settings/values` calls `initializer()` directly | Two DB queries per request, bypassing L1/L2 | P1 |
| P-04 | DB pool max 10 per worker; cluster multiplies connections; no PgBouncer | Connection exhaustion risk as replicas/workers scale | P1 |
| P-05 | No `statement_timeout`, `lock_timeout`, or `idle_in_transaction_session_timeout` | Long queries/transactions can exhaust the pool and block others | P1 |
| P-06 | Leading-wildcard search on six user columns without trigram indexes | Sequential scans and CPU-heavy `LIKE '%...%'` at scale | P2 |
| P-07 | `route_guards` lacks an index on `role_id` | Cache-build join and filtered browse degrade with table growth | P1 |
| P-08 | Expired sessions are purged only opportunistically on login/TFA | Inactive users' sessions accumulate; table growth | P1 |
| P-09 | No scheduled cleanup for recovery/TFA rows | Expired codes accumulate indefinitely | P1 |
| P-10 | Email sent inside a DB transaction | Slow SendGrid calls hold connections/transactions; pool pressure | P1 |
| P-11 | Registration creates user + session outside a transaction | Partial user on session failure; retry conflicts | P1 |
| P-12 | Password reset updates password + deletes recovery row outside a transaction | Partial state; manual repair needed | P1 |
| P-13 | Offset pagination for roles/settings/route guards | Deep offsets scan/skip rows; acceptable for small admin tables, not for growth | P2 |
| P-14 | No N+1 pattern found | Positive; keep single-query repository style | — |
| P-15 | Validation and cache failures use `console.error` instead of the logger | Errors bypass structured logging/redaction and are hard to correlate | P1 |
| P-16 | Cluster `CLUSTER_WORKERS=` -> `NaN`; no primary signal handling | Zero workers or abrupt shutdown | P1 |
| P-17 | Default JSON body limit 100 KB; compression enabled | Reasonable, but set explicit limits and proxy timeouts | P2 |
| P-18 | Authentication does one session query per request (plus optional user query) | Acceptable; ensure PK lookup and avoid caching auth decisions without revocation | — |
| P-19 | Cache stampede possible at boot/multiple workers | Many workers may query DB simultaneously to warm cache; use singleflight/lock | P2 |
| P-20 | Migrations create indexes non-concurrently | Lock risk on large production tables | P1 |
| P-21 | `UserRepository.update` does a `SELECT` existence check then `UPDATE` | Two round trips; can be one `UPDATE ... RETURNING` | P2 |
| P-22 | `purgeExpiredTokensByUserId` runs on every login | Extra delete per login; indexed but avoidable with scheduled cleanup | P2 |
| **P-23** | **FK CASCADE on `authentication_tokens`, `two_factor_authentications`, `route_guards`** | Soft delete pattern broken; cascading deletes destroy audit data | P1 |
| **P-24** | **No `expired_at` filter in `findById`** | Session lookup doesn't enforce expiry; index on `expired_at` unused | P0 |
| **P-25** | **User browse docs show `limit` param but middleware reads `per_page`** | API/docs mismatch; pagination silently ignored | P2 |

### 7.5 Capacity Model (Illustrative)

These are planning assumptions, not measurements:

- bcrypt cost 12 typically costs on the order of 200–400 ms per hash/compare on a shared vCPU. That limits login throughput per core to roughly 3–5 operations/second before other work. Rate limits and capacity must account for this.
- If each worker uses `DB_POOL_MAX=10` and a replica runs 4 workers, that is 40 connections per replica. Two replicas = 80 connections, plus migrations/admin/monitoring, close to PostgreSQL’s default `max_connections=100`.
- A safe formula is:

```text
pool_max_per_worker = floor((postgres_max_connections - reserve) / total_app_workers)
```

For example, with `max_connections=200`, `reserve=20`, and 8 workers: `floor(180 / 8) = 22`. Use a lower number to leave headroom, or put PgBouncer in transaction-pooling mode in front of PostgreSQL.
- Redis cache with bcrypt-per-operation is not a capacity win. Fix P-01 before relying on Redis for latency.

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
| Auth endpoint rate-limit false positives | < 0.1% of legitimate traffic |
| Memory growth during soak | No unbounded growth |

### 7.7 Load-Test Plan

The repository already has Artillery configs. Use them, but make the scenarios match real traffic and run them against a staging-like environment with Redis enabled and SendGrid mocked.

**Profiles**

| Profile | Duration | Load | Purpose |
| --- | --- | --- | --- |
| Smoke | 1 min | 1–5 req/s | Verify wiring and thresholds in CI |
| Baseline | 10–15 min | 10–50 req/s | Establish p50/p95/p99 and error rate |
| Stress | 10–20 min | Ramp until failure | Find saturation point and failure mode |
| Spike | 5 min | Sudden 2–5× baseline | Test recovery and autoscaling |
| Soak | 2–4 hours | 20–50 req/s | Detect leaks, pool drift, table growth |

**Scenarios**

- Login + logout.
- Login + authenticated user browse/view.
- Login + settings values.
- Admin user create/update/delete (with cleanup).
- Password recovery send/validate (mock email; avoid real sends).
- TFA send/validate (mock email).
- Mixed read/write with realistic think time.

**Metrics to capture**

- HTTP p50/p95/p99, RPS, 2xx/4xx/5xx.
- CPU, memory, event-loop lag, GC.
- PostgreSQL connections, pool wait, slow queries, locks, deadlocks, CPU/IO.
- Redis latency, errors, hit ratio, memory.
- bcrypt CPU time; login latency distribution.
- Error logs by code (401/403/429/500).

**Pass criteria**

- Budgets in Section 7.6 met at expected peak.
- No pool exhaustion or connection errors.
- No unbounded memory growth.
- Recovery to baseline after spike within a defined window.
- Rate limits behave as designed and do not block legitimate load-test users unintentionally.

**CI cadence**

- PR/main: smoke.
- Nightly: baseline.
- Weekly: stress.
- Monthly: soak and restore drill.

### 7.8 Database Operations Checklist

- Enable `pg_stat_statements`; review top queries by total time and calls.
- Enable `auto_explain` or `log_min_duration_statement=100ms` in staging/production.
- Log lock waits and deadlocks; set `deadlock_timeout`.
- Run `EXPLAIN (ANALYZE, BUFFERS)` for login, user browse, search, settings values, route-guard cache build, and recovery flows.
- Tune autovacuum for high-churn tables (`authentication_tokens`, `password_recoveries`, `two_factor_authentications`).
- Monitor index bloat and unused indexes.
- Use `CREATE INDEX CONCURRENTLY` for large tables; set `lock_timeout` for migrations.
- Use a separate migration role with DDL privileges; runtime role gets only DML on required tables/sequences.
- Enforce TLS and `scram-sha-256`; restrict `pg_hba.conf`.
- Configure backups and point-in-time recovery; run restore drills.
- Evaluate table partitioning for audit logs if volume grows.
- Evaluate read replicas only if read load and latency require them; do not add prematurely.
- Evaluate RLS only if multi-tenancy becomes a requirement.

---

## 8. Recommended Features

### 8.1 How to Read This Section

Each feature is written as an implementation-ready card. “Status” uses the conventions defined at the top of this document. “Complexity” is a rough single-engineer estimate (S < 1 day, M 1–3 days, L 3–10 days, XL > 10 days) and excludes review, deployment, and product-specific work. Dependencies refer to other feature IDs in this section unless stated otherwise.

The ordering is deliberate. P0 features repair security and correctness invariants; they are not optional enhancements. P1 features make the system operable and defensible in production. P2 features improve scale and developer experience. P3 features are optional and should be funded only by a concrete product requirement.

### 8.2 Feature Summary

| ID | Feature | Priority | Current status | Complexity | Depends on |
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

> **Implementation notes.** The status column records the state of the
> repository after the implementation work. F-27 is partially
> implemented: the field-level rules and the ownership checks for the
> user's own record are in place, but there is no generalized
> `can(actor, action, resource)` policy applied to every resource
> type. F-30 is deferred on purpose: the blueprint places it in the
> optional P3 phase, which "only starts with a funded requirement and a
> written ADR". The deferral and the remaining decisions are recorded
> in [`docs/adr/README.md`](adr/README.md).

### 8.3 P0 Feature Cards

### 8.3 P0 Feature Cards

#### F-01 — Repair scalar uniqueness and role-existence validation

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | S |
| Dependencies | None |

**Description.** Make `validateCompositeUnique` work for both scalar Joi fields and object-level composite fields, and replace the invalid `roles.role_id` existence check with a correct `roles.id` check.

**Problem solved.** Duplicate usernames, emails, and phone numbers currently pass validation and would fail at the database with a generic 500. Admin user creation and updates always fail because they query a column that does not exist. This is a core correctness and user-facing reliability defect.

**Implementation approach.**

1. Split the validator into `validateUnique(table, column, options)` for scalar fields and keep `validateCompositeUnique(table, columns, options)` for object schemas. Alternatively, make the existing function detect whether the value is an object and select the correct comparison.
2. Always compare with the `ignoreId` row excluded when provided. Validate `idColumn` and `table` with the existing identifier allowlist.
3. Replace `validateCompositeUnique("roles", ["role_id"])` with `validateExists("roles", {column: "id"})` in `userCreateSchema` and `userUpdateSchema`.
4. Ensure empty strings and `null` follow the schema’s `allow(null, "")` semantics and do not trigger a uniqueness query.
5. Add database-level unique constraints as the final authority (they already exist for `users.username`, `users.email`, `users.phone`) and map violations to 409 in F-15.

**Security considerations.** Uniqueness checks must not leak whether an account exists through distinct error messages. Use a generic “already in use” response. Do not build SQL identifiers from user input; keep the allowlist. Ensure the validation query cannot be used as a timing oracle for account existence beyond what registration already implies.

**Performance considerations.** One indexed lookup per validated field. Avoid duplicate checks by letting the database constraint handle races. Do not wrap validation in a long transaction.

**Tests.**

- **Unit:** scalar validator accepts a free value; rejects an existing value; ignores the current row on update; handles `null`/empty; composite validator still works; invalid identifiers throw.
- **Integration:** register with an existing username/email/phone returns 409, not 500; admin create user succeeds with a valid role; admin update user succeeds and does not collide with the acting admin’s own values.
- **E2E:** admin creates a user, edits it, and lists it; duplicate registration shows a field-level error.
- **Load:** registration and admin create under concurrent duplicates produce exactly one success and deterministic 409s, with no unhandled 500s.

#### F-02 — Fix user update identity and admin user CRUD validation

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | S |
| Dependencies | F-01 |

**Description.** Pass the target user’s route ID as `ignoreId` during user updates, and make the admin user create/update schemas match the actual database and API contract.

**Problem solved.** `user.routes.ts` currently passes the acting admin’s `uid` as `ignoreId`, so uniqueness checks exclude the wrong row. Combined with the broken role validator, admin user management is unusable.

**Implementation approach.**

1. Change the update route to `validate((req) => userUpdateSchema(req.params.id), [...])` and ensure the schema closure uses the route ID, not `req.credentials.jwt.uid`.
2. Reject non-positive/non-integer IDs before validation and return 400, not a database error.
3. Align `status` with the `NOT NULL` column: disallow `null`; use a dedicated enum or omit the field when unchanged.
4. Remove `password` from admin update unless there is an explicit reset-password endpoint with its own authorization and audit event.
5. Return 200 with the updated representation or 204 consistently; document the choice.
6. Add a regression test that updates a user whose email equals the admin’s email and verifies the correct row is ignored.

**Security considerations.** A user with `users:update` can currently change `role_id` and `status`; treat those as privileged fields and require an admin-only permission (see F-27). Prevent privilege escalation by ensuring a non-admin cannot assign a role with `is_bypass_authorization`. Audit role/status changes (F-19).

**Performance considerations.** No additional queries beyond validation and the update. Use a single `UPDATE ... RETURNING` where possible (F-15).

**Tests.**

- **Unit:** schema factory uses the supplied ID; `status: null` is rejected; privileged fields are rejected for non-admin actors.
- **Integration:** update self and update another user both succeed with correct uniqueness behavior; update with a duplicate email returns 409; update with an invalid role returns 422/404.
- **E2E:** admin edits a user and the change is visible in browse/view.
- **Load:** concurrent updates to the same user do not produce lost-update anomalies beyond last-write-wins; add optimistic concurrency if required.

#### F-03 — Unify access-token issuance and remove the `tid: 0` bypass

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-02 |

**Description.** Define one access-token contract for every issuance path. Every token must reference a live session, the user, the current authorization state, and the TFA state. Remove the `tid: 0` special case from authentication middleware.

**Problem solved.** `AccountService.information` and `AccountService.password` mint tokens with `tid: 0` and no `rol`/`bpa`. Those tokens skip the session-existence check and fail authorization. Logout cannot revoke them. The result is both a security bypass and a broken account workflow.

**Implementation approach.**

1. Create a single `TokenIssuer`/`SessionService` used by login, registration, account updates, TFA verification, and password reset. It creates or rotates a session row and signs the token from that row.
2. Token claims: `sub`/`uid`, `tid`, `tfa`, `rol`, `bpa`, `iss`, `aud`, `jti`, `iat`, `exp`. Do not add mutable authorization data without a version check (F-13).
3. Account profile/password updates should keep the existing session ID and issue a fresh token with the same claims, or rotate the session and revoke the old one. Never issue `tid: 0`.
4. On password change, revoke all other sessions and keep the current one only if the product requires it; document the choice.
5. Make authentication middleware reject missing/invalid `tid` instead of bypassing the lookup.
6. Add a shared helper to assert credentials so controllers do not each invent their own checks.

**Security considerations.** The session row is the revocation authority. Do not trust a token merely because its signature is valid. Include `jti` for traceability. If refresh tokens are added later (F-11), keep access tokens short-lived and refresh tokens rotating. Ensure token issuance does not log secrets.

**Performance considerations.** One session lookup per authenticated request is acceptable; it is a primary-key read. Avoid caching session validity without a revocation channel. Token signing is cheap relative to bcrypt.

**Tests.**

- **Unit:** token issuer always includes a positive `tid`; account updates preserve/rotate correctly; middleware rejects `tid: 0`, missing `tid`, and unknown sessions.
- **Integration:** profile update returns a token that can call an authorized endpoint; password change returns a usable token and revokes other sessions; logout invalidates the token immediately.
- **E2E:** full login → profile update → authorized request → logout flow.
- **Load:** authenticated read throughput with one session lookup per request remains within budget; no session-table hotspot.

#### F-04 — Enforce session expiry, account status, and revocation

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-03 |

**Description.** Make authentication decisions depend on the current database session and user state, not only on a valid JWT signature.

**Problem solved.** Expired session rows are accepted, suspended/deactivated users can log in and continue using tokens, and status changes do not revoke access. A stolen token remains usable for the full JWT lifetime.

**Implementation approach.**

1. `AuthenticationTokenRepository.findById` must filter `id = ? AND user_id = ? AND expired_at > now()`. Return `null` for expired/mismatched rows.
2. Load the user (or a minimal status/role projection) during authentication and reject unless status is `Activated` (or an explicitly allowed onboarding status).
3. On status change, role change, password reset, or admin "revoke sessions" action, delete or expire all sessions for the user in the same transaction.
4. Add `logout-all` and per-session revocation endpoints (the latter can be P1).
5. Reset `login_tries` and `failed_login_expired_at` on successful login.
6. Add a scheduled cleanup job for expired sessions (F-20); keep a bounded opportunistic purge only if needed.
7. Return generic 401 responses; do not reveal whether the session expired, the user is suspended, or the token is invalid.
8. Ensure `expired_at` is `NOT NULL` for new rows and backfill existing rows (migration).

**Security considerations.** Check status on every request or use a version claim that is incremented on status/role change. The latter avoids a user query per request but requires a reliable invalidation path. Never allow an admin to "unlock" an account without auditing it.

**Performance considerations.** Primary-key session lookup plus an optional user lookup. If adding a user query per request is too expensive, cache a minimal `{status, role_version}` with a short TTL and invalidate on change. Do not cache negative authorization decisions indefinitely.

**Tests.**

- **Unit:** repository excludes expired/mismatched sessions; status policy rejects each non-active status; successful login resets counters.
- **Integration:** expired session returns 401 even with a valid JWT; suspended user cannot log in; status change revokes existing tokens; password reset revokes sessions.
- **E2E:** admin suspends a user and the user’s next request fails; reactivation requires a new login.
- **Load:** per-request session/status checks stay within the authenticated-read budget.

#### F-05 — Replace destructive deletion semantics

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | S |
| Dependencies | F-04 (session revocation required for soft delete) |

**Description.** Change `users.role_id` from `ON DELETE CASCADE` to `ON DELETE RESTRICT`, change `authentication_tokens.user_id`, `two_factor_authentications.token_id`, and `route_guards.role_id` FKs from CASCADE to RESTRICT, make user deletion soft by default, and guard deletion of roles/settings/route guards that are in use.

**Problem solved.** Deleting a role currently deletes every user assigned to it. Deleting a user cascades to sessions and TFA records, breaking audit trail. Hard-deleting users destroys account history and audit evidence. Both are routine admin actions with catastrophic side effects.

**Implementation approach.**

1. Add a migration that drops and recreates the following FKs with `ON DELETE RESTRICT` (or `NO ACTION`):
   - `users_role_id_fk` (users → roles)
   - `authentication_tokens_user_id_fk` (authentication_tokens → users)
   - `two_factor_authentications_token_id_fk` (two_factor_authentications → authentication_tokens)
   - `route_guards_role_id_fk` (route_guards → roles)
   Backfill/repair any orphaned rows first.
2. Change `UserController.delete` to call `softDelete` (set `deleted_at`, anonymize or retain PII according to policy) and revoke sessions in the same transaction (requires F-04).
3. Add an explicit `hard_delete` operation restricted to a super-admin, requiring a reason and producing an audit event.
4. For roles, settings, and route guards, return 409 when referenced; require reassignment or explicit cascade with confirmation.
5. Ensure all read paths filter `deleted_at IS NULL` (users already do; verify joins and auth lookups).
6. Document retention and erasure policy.

**Security considerations.** Soft delete must also prevent login and token use. Anonymization must not break foreign keys or audit records. Do not allow a user to delete themselves through an admin endpoint without explicit policy. Audit every destructive action.

**Performance considerations.** Soft deletes require `deleted_at` predicates to use existing indexes; verify query plans. Partial indexes on active rows can help. Avoid adding `deleted_at` to every table without a query review.

**Tests.**

- **Unit:** delete service sets `deleted_at`, revokes sessions, and refuses hard delete without permission.
- **Integration:** deleting a role with users returns 409; deleting a user makes login and existing tokens fail; browse excludes deleted users; session/TFA records not cascaded on user delete.
- **E2E:** admin deletion flow with confirmation and audit record.
- **Load:** browse queries remain index-backed with the soft-delete predicate.

#### F-06 — Add authentication abuse controls and rate limiting

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-09 |

**Description.** Add layered rate limits and progressive controls for login, registration, password recovery, TFA send/validate, and other sensitive endpoints.

**Problem solved.** There is currently no IP, device, or global rate limit. Per-account lockout alone enables account-lockout denial of service and does not stop distributed credential stuffing, OTP brute force, recovery-email bombing, or registration spam.

**Implementation approach.**

1. Add a rate-limit middleware with a Redis store when available and an in-memory fallback for single-instance development. Use fixed/sliding windows with separate buckets.
2. Limits (starting points, tune with load tests):
   - Login: per IP and per username, e.g. 10/minute and 100/hour; progressive delay after 3 failures.
   - Registration: per IP, e.g. 5/hour; require email verification (F-12) before full access.
   - Password recovery send: per IP and per target, e.g. 3/15 minutes, 10/day.
   - Password recovery validate: per code/target, 5 attempts.
   - TFA send: per session/user, e.g. 3/10 minutes; TFA validate: 5 attempts per code.
   - Global auth endpoints: circuit-breaker-style cap to protect bcrypt CPU.
3. Return `429` with `Retry-After`; do not reveal whether the account exists.
4. Reset counters on successful authentication where appropriate; keep IP-level counters longer.
5. Log rate-limit events with hashed identifiers for privacy.
6. Ensure proxy trust is configured so `req.ip` is correct (F-10).

**Security considerations.** Do not key solely on IP (NAT, IPv6 rotation) or solely on account (lockout DoS). Use both plus a device/session signal where available. Store counters with TTLs; avoid unbounded memory. Rate limiting is not a substitute for MFA, breached-password screening, or WAF controls. Protect the limiter itself from cardinality attacks by capping key length and using hashed keys.

**Performance considerations.** Redis round trip per sensitive request; keep it off hot read paths. Use pipelining/atomic Lua for increment+expire. In-memory fallback must be per-worker and documented as approximate. Monitor limiter latency and Redis failures; fail open or closed deliberately (auth endpoints should fail closed or apply a conservative local limit).

**Tests.**

- **Unit:** limiter increments, expires, returns 429, and isolates buckets; key hashing is stable.
- **Integration:** repeated failed logins return 429; successful login resets the account bucket; recovery send is limited per IP and target; TFA attempts are limited.
- **E2E:** attacker simulation across multiple accounts is throttled without locking a victim out permanently.
- **Load:** limiter adds < 5 ms p95; Redis outage behavior is defined and tested.

#### F-07 — Enforce a coherent TFA policy and repair OTP lockout

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-04, F-06 |

**Description.** Choose and enforce one TFA policy (global or per-user), make `has_tfa` accurate, repair the permanent-lockout bug, and make OTP endpoints safe and idempotent.

**Problem solved.** TFA is currently optional at login but mandatory for account routes, no flow sets `has_tfa`, and a token can become permanently unable to verify an OTP. This creates a false sense of security and a denial-of-service path.

**Implementation approach.**

1. Decide policy:
   - **Global:** `tta_req` requires TFA for all users; login returns a restricted token with `tfa: false` and a narrow scope; only TFA validate can upgrade it.
   - **Per-user:** `has_tfa` requires TFA; enrollment is explicit and requires re-authentication; users can disable with re-authentication and audit.
2. Implement enrollment: generate/verify a secret or email OTP, set `has_tfa = true` only after successful verification, and store recovery codes.
3. Login response should state `tfa_required` and never grant full access before TFA completes.
4. On `tries >= MAX`, set `expired_tries_at` to a future time (e.g., `now() + lockout_duration`) and return a retry time. On new OTP issuance, reset `tries` to 0, clear `expired_tries_at`, and enforce `next_send_at`.
5. Use POST for send/validate. Validate `req.sanitize.data`, not raw `req.body`.
6. Rate-limit sends/attempts (F-06). Make OTP single-use and delete/mark it on success in a transaction.
7. Prefer TOTP or WebAuthn for new enrollments (F-30); keep email OTP as a fallback.

**Security considerations.** A restricted token must not pass normal authorization. Do not disclose whether TFA is enabled for an account during login beyond what the flow requires. OTPs must be hashed at rest, expire quickly, and be compared in constant time via bcrypt. Recovery codes must be hashed and single-use. Changing email/phone must not silently disable or bypass TFA.

**Performance considerations.** bcrypt verification per attempt is intentional; rate limits cap CPU. Avoid sending email inside a transaction (F-20). Cache the TFA policy setting; invalidate on change.

**Tests.**

- **Unit:** policy resolution for global/per-user; lockout sets and clears expiry; new OTP resets tries; restricted token cannot access protected routes.
- **Integration:** login for a TFA user returns restricted access; validate upgrades; wrong code increments and eventually returns retry-after; new OTP unlocks; `has_tfa` reflects enrollment.
- **E2E:** enroll → logout → login → TFA → access; disable TFA with re-authentication.
- **Load:** OTP send/validate under rate limits; email provider mocked; no transaction held during send.

#### F-08 — Make password recovery atomic, non-enumerating, and revoking

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-04, F-06 |

**Description.** Make password recovery return a constant response, send notifications outside the database transaction, reset the password and delete the recovery row atomically, revoke all sessions, and implement or remove the phone channel.

**Problem solved.** The current flow leaks account existence, holds a transaction during email delivery, can leave partial state, and leaves stolen sessions valid after a reset. Phone recovery reports success without sending anything.

**Implementation approach.**

1. `sendRecoveryCode` always returns the same shape and status. Do not include `next_resend_at` only for existing accounts. Apply cooldowns uniformly, including for unknown targets (store a hashed target marker or use a generic rate limit).
2. Generate a high-entropy code, store only its bcrypt hash, set expiry and resend/try timestamps, and send the notification after the transaction commits.
3. Use an outbox/job (F-20) for email; if not yet available, commit first and send best-effort with retry/logging.
4. `validateRecoveryCode` runs in one transaction: lock the recovery row, verify code/tries/expiry, update the password, delete the recovery row, reset lockout counters, and revoke all sessions. Commit, then optionally send a "password changed" notification.
5. Implement phone delivery through a real provider or return a clear "channel unavailable" error and disable the option. Do not claim success when nothing was sent.
6. Add per-target and per-IP rate limits (F-06).
7. Ensure codes are single-use and invalidated on new issuance.
8. In `AccountService.password` (account password change), delete all `password_recoveries` rows for the user in the same transaction to prevent stale recovery tokens.

**Security considerations.** Constant response shape and comparable timing reduce enumeration. Do not log codes or reset tokens. Revoke sessions on reset. Require re-authentication for email changes. Use generic errors for invalid/expired codes. Consider notifying the user of a reset attempt.

**Performance considerations.** bcrypt hashing/verification dominates; rate limits protect CPU. Keep transactions short by moving email out. Index `(type, send_to)` already exists.

**Tests.**

- **Unit:** response is identical for known/unknown targets; code expiry/tries enforced; transaction rolls back on failure; sessions revoked.
- **Integration:** full reset flow; old password fails, new password works; old tokens fail; phone channel behavior matches configuration.
- **E2E:** request reset, receive mocked email, reset, log in, verify other sessions are gone.
- **Load:** recovery send/validate under rate limits with mocked email; no pool exhaustion.

#### F-09 — Validate environment configuration and require secrets

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | S |
| Dependencies | — |

**Description.** Replace ad-hoc environment parsing with a validated schema that fails fast on missing/invalid values and enforces production-specific constraints.

**Problem solved.** Empty `JWT_SECRET`, `BCRYPT_SECRET`, and `CRYPT0_SECRET` are accepted at boot; `CLUSTER_WORKERS=` becomes `NaN`; `CRYPT0_SECRET` length is unchecked; unsafe defaults can reach production.

**Implementation approach.**

1. Define a Joi (or equivalent) schema for every environment variable: required strings, integer ranges, booleans as exact `"true"`/`"false"`, URLs, file paths, and secret minimum lengths.
2. Production rules: require non-placeholder secrets of sufficient entropy, require `CORS_ORIGINS` to be an explicit list, require TLS for DB/Redis where applicable, disallow `CLUSTER_WORKERS` empty/NaN, and require `SENDGRID_API_KEY` if email features are enabled.
3. Remove or implement dead variables (`JWT_TFA`, `CRYPTO_IV`). Do not leave parsed-but-unused configuration.
4. Parse once at startup and export a typed, frozen object. Use `Number.parseInt(value, 10)` with explicit radix; reject `NaN` for integer configs.
5. Validate `CRYPT0_SECRET` is exactly 32 bytes (or derive via HKDF-SHA-256).
6. Fix `CLUSTER_WORKERS` parsing: default to `os.cpus().length` when unset; reject empty string; validate positive integer.
7. Provide a `.env.example` with safe placeholders and comments; never commit real secrets.
8. Add a startup self-check that logs a redacted configuration summary (no secret values).

**Security considerations.** Fail closed in production. Do not print secret values in errors. Support secret injection from the platform/secret manager rather than `.env` files in production. Validate `CRYPT0_SECRET` as 32 bytes or derive a key via HKDF (F-16). Ensure `HAS_PROXY` is correct to avoid IP spoofing in rate limits/audit logs.

**Performance considerations.** Validation runs once at boot; negligible. Avoid filesystem reads of TLS material until needed, but validate paths exist.

**Tests.**

- **Unit:** schema accepts a valid config; rejects missing/short secrets; rejects `NaN` workers; production rejects wildcard CORS and missing TLS.
- **Integration:** app boot fails with a clear error for invalid config; valid test config boots.
- **E2E:** deployment smoke test asserts the process exits non-zero on invalid config.
- **Load:** not applicable beyond boot time.

#### F-10 — Replace wildcard CORS and harden transport defaults

| Field | Value |
| --- | --- |
| Priority | P0 |
| Status | **Implemented** |
| Complexity | S |
| Dependencies | F-09 |

**Description.** Replace the permissive CORS default with an explicit allowlist, reject wildcard-with-credentials, and tune Helmet, body limits, proxy trust, and state-changing methods.

**Problem solved.** `CORS_ORIGINS=*` or an empty value reflects any origin with `credentials: true`. This is an unsafe default that can expose authenticated responses if cookie-based auth is added, and it weakens origin trust today. `GET` logout/OTP-send are also state-changing.

**Implementation approach.**

1. Parse `CORS_ORIGINS` as a comma-separated allowlist. In production, require at least one explicit origin; reject `*` when `credentials: true`.
2. Configure `methods`, `allowedHeaders`, `exposedHeaders`, and `maxAge` explicitly. Do not reflect arbitrary origins.
3. Keep Helmet, add HSTS in production, and set a Content Security Policy appropriate to any HTML surface (API JSON may use a restrictive default).
4. Set explicit JSON/urlencoded body limits and reject unsupported content types where appropriate.
5. Set `trust proxy` only when `HAS_PROXY=true` and document the expected proxy topology.
6. `GET /auth/logout` and `GET /auth/tfa/send` are removed; only POST is supported.
7. Add `server.headersTimeout`, `requestTimeout`, and `keepAliveTimeout` appropriate to the deployment.

**Security considerations.** CORS is not authentication; do not rely on it to protect data. If cookies are introduced, add CSRF protection (SameSite + token). HSTS requires HTTPS everywhere, including subdomains if `includeSubDomains`. Validate `Origin` for state-changing requests when credentials are used.

**Performance considerations.** CORS preflight caching reduces overhead. Body limits protect memory. Timeouts protect against slowloris.

**Tests.**

- **Unit:** origin parser handles lists, whitespace, and wildcard rejection; config rejects wildcard+credentials in production.
- **Integration:** allowed origin gets CORS headers; disallowed origin does not; preflight works; oversized body returns 413.
- **E2E:** browser-like flow from the allowed origin succeeds; from another origin fails.
- **Load:** preflight and body-limit behavior under load; timeout settings do not cut legitimate slow requests.

### 8.4 P1 Feature Cards

#### F-11 — Short-lived access tokens with rotating refresh tokens

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | L |
| Dependencies | F-03, F-04 |

**Description.** Introduce a two-token model: a short-lived access token (10–15 minutes) and a long-lived, rotating refresh token stored hashed at rest. Detect refresh-token reuse and revoke the token family.

**Problem solved.** The current access token is valid for 7 days by code default and 60 days in `.env.example`. Revocation only works while the session row exists, and a stolen token has a long useful life. A refresh model reduces the blast radius and enables session management.

**Implementation approach.**

1. Add a `refresh_tokens` table: `id`, `session_id`, `user_id`, `token_hash`, `family_id`, `expires_at`, `revoked_at`, `replaced_by`, `created_at`, `ip`, `user_agent`.
2. Issue an opaque random refresh token (at least 256 bits), store only a SHA-256/HMAC hash, and return it in an `HttpOnly; Secure; SameSite=Lax/Strict` cookie scoped to the refresh endpoint.
3. Rotate on every refresh: mark the old token used/revoked, issue a new one in the same family, and update the session. If a revoked/used token is presented, revoke the entire family and alert.
4. Keep access tokens stateless for signature/claims but still check the session row for revocation and status (F-04).
5. Add `/auth/refresh`, `/auth/logout` (revoke current family), and `/auth/logout-all`.
6. Add CSRF protection for the cookie-based refresh endpoint: origin check plus a double-submit token or a custom header requirement.
7. Store refresh tokens hashed; never log them. Cap active sessions per user and expose a session list/revoke UI/API.
8. Make lifetimes configurable and validated (F-09).
9. Pin JWT algorithm to `HS256` (or `RS256`/`EdDSA`); add `iss`, `aud`, `jti` claims; validate all on verify.

**Security considerations.** Refresh token rotation with reuse detection is essential; without it, a stolen refresh token is as bad as a long-lived access token. Use constant-time comparison for hashes if compared directly. Bind tokens to the session, not just the user. Revoke on password change, status change, and suspected compromise. Consider device binding only if the product needs it; it can create support burden. Algorithm pinning prevents algorithm confusion attacks.

**Security considerations.** Refresh token rotation with reuse detection is essential; without it, a stolen refresh token is as bad as a long-lived access token. Use constant-time comparison for hashes if compared directly. Bind tokens to the session, not just the user. Revoke on password change, status change, and suspected compromise. Consider device binding only if the product needs it; it can create support burden.

**Performance considerations.** Refresh happens rarely relative to API calls; one indexed lookup and update per refresh is acceptable. Access-token verification remains cheap. Clean up expired refresh tokens on a schedule (F-20).

**Tests.**

- **Unit:** rotation marks the old token used; reuse revokes the family; expiry/revocation enforced; hash storage never contains the raw token.
- **Integration:** login sets a refresh cookie; refresh returns a new access token and rotates; reuse returns 401 and revokes; logout clears the cookie and session; logout-all revokes every family.
- **E2E:** browser-like flow with cookie handling and CSRF protection; concurrent refresh requests do not create duplicate valid families.
- **Load:** refresh endpoint under bursty load; no race that invalidates legitimate concurrent tabs (define grace behavior).

#### F-12 — Implement email and phone verification

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-06, F-08 |

**Description.** Add verification flows for email and phone, set `is_email_verified`/`is_phone_verified` only after proof of possession, reset flags when the contact changes, and gate sensitive features on verification.

**Problem solved.** The schema tracks verification flags, but nothing sets them. Account email/phone changes do not require re-verification, so a compromised session can redirect recovery to an attacker-controlled address.

**Implementation approach.**

1. Add a `verification_tokens` table or reuse a generic one-time-token table: `user_id`, `channel`, `target_hash`/target, `token_hash`, `expires_at`, `consumed_at`, `created_at`, `attempts`.
2. Endpoints: `POST /account/email/verification/send`, `POST /account/email/verification/confirm`, and equivalents for phone. Require authentication and rate limiting.
3. On email/phone change, set the corresponding flag to `false`, store the pending value (or update and mark unverified), and send a verification message to the new target. Do not allow recovery to an unverified target.
4. Use high-entropy tokens, store hashes, single use, short expiry (e.g., 24 hours for email, 10 minutes for SMS), and resend limits.
5. Decide which features require verification: password recovery, TFA enrollment, admin invitations, and possibly login. Document the policy.
6. Add a “verify your email” banner/response flag for clients.
7. Send notifications through the outbox (F-20), not inside transactions.

**Security considerations.** Never reveal whether an email/phone is already registered through verification endpoints. Prevent token fixation by binding the token to the user and target. Invalidate old tokens when a new one is issued or the target changes. Phone verification costs money; rate-limit and monitor. Do not allow verification of a target already owned by another account.

**Performance considerations.** Indexed lookups by token hash; cleanup expired tokens. Email/SMS delivery is external and must not block requests.

**Tests.**

- **Unit:** token generation/hash/expiry; flag transitions; target-change invalidation.
- **Integration:** send + confirm sets the flag; expired/reused token fails; changing email resets the flag and blocks recovery until verified; duplicate target returns a generic response.
- **E2E:** registration → verify email → enable recovery; change email → old recovery stops working.
- **Load:** verification send/confirm under rate limits with mocked providers.

#### F-13 — Make authorization state fresh and route guards consistent

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-03, F-04 |

**Description.** Ensure authorization reflects current roles/permissions rather than stale JWT claims, add a unique constraint and index for route guards, seed canonical route permissions, and make the admin bypass explicit and auditable.

**Problem solved.** Role and bypass claims are trusted until token expiry. A demoted or suspended admin retains access. Route guards have no seed, no uniqueness constraint, and no `role_id` index, so non-admin roles have no permissions and duplicate grants are possible.

**Implementation approach.**

1. Add `users.authorization_version` (or `role_version`) incremented on role change, status change, and permission changes. Include it in the token and compare against the current value during authentication. Alternatively, resolve the role from a short-TTL cache and invalidate on change.
2. Add a migration: unique `(role_id, route)` on `route_guards`, index `role_id`, and a check that `route` is non-empty and normalized (e.g., `resource:action`). Change `route_guards.role_id` FK from `ON DELETE CASCADE` to `ON DELETE RESTRICT`.
3. Seed route guards for `admin`, `manager`, and `customer` from a single canonical route catalog. Keep the catalog in code and generate the seed to avoid drift.
4. Make `is_bypass_authorization` a protected field; only a super-admin can set it, and every change is audited.
5. Log authorization denials with actor, role, route, request ID, and result.
6. Add a route/role matrix test that asserts allowed and denied routes for each seeded role.
7. Consider normalizing permissions into `permissions`/`role_permissions` only if the route string catalog becomes unmanageable (F-27); do not do it prematurely.

**Security considerations.** Fail closed on cache misses and unknown roles. Never accept a role slug from the client. Protect against privilege escalation through role assignment. The bypass flag must not be grantable through a general role update endpoint without super-admin authorization. Stale caches are a security risk; use TTL + explicit invalidation.

**Performance considerations.** A version check can use the user row already loaded for status (F-04). A role lookup cache should be small and invalidated by pub/sub. The route-guard cache build should use the new index and be warmed at boot.

**Tests.**

- **Unit:** version mismatch rejects; bypass flag protected; route normalization; cache invalidation.
- **Integration:** role change takes effect on the next request; demoted admin loses access; duplicate route guard returns 409; seeded roles have expected permissions.
- **E2E:** admin changes a user’s role and the user’s UI/API access changes without re-login (or with a forced refresh, per design).
- **Load:** authorization cache hit path stays within budget; invalidation storm does not cause a thundering herd (singleflight).

#### F-14 — Repair admin browse filters and settings cache usage

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | S |
| Dependencies | None (F-16 optionally hardens the cache path) |

**Description.** Fix the `numeric()`/`get()` filter semantics in settings, roles, and route-guard browse controllers; make `search` optional and safely trimmed; and serve `/settings/values` from cache with correct visibility and authentication.

**Problem solved.** Absent query parameters currently become `0`, producing unintended `is_disabled=false`, `is_public=false`, or `role_id=0` filters. `search.trim()` can throw when `search` is absent. `/settings/values` runs two database queries per request and requires authentication even though it returns public settings.

**Implementation approach.**

1. Replace `numeric()` with a parser that returns `undefined` when the parameter is absent, and only converts when present and non-empty.
2. Replace `get(...) !== null` checks with explicit `undefined`/empty checks. Trim only after confirming the value is a string.
3. Use a shared query parser for `page`, `per_page`, `search`, booleans, and IDs. Reject invalid values with 400/422 instead of silently coercing.
4. For `/settings/values`, decide the contract: public endpoint returning only `is_public=true` and `is_disabled=false`, served from the same L1/L2 cache as `initializer()`. If authenticated values are required, split into `/settings/values` (public) and `/settings/admin-values` (authenticated).
5. Add cache-control headers/ETag for public settings if clients poll.
6. Add tests for absent, empty, `0`, `false`, and invalid values.

**Security considerations.** Public settings must never include secrets or internal configuration. Filter by `is_public` server-side, not client-side. Avoid exposing disabled settings. Ensure admin browse requires the correct permission and does not leak data through error messages.

**Performance considerations.** Eliminates two DB queries per `/settings/values` request. Use the existing cache and a short TTL. Avoid caching per-user responses in a shared key.

**Tests.**

- **Unit:** parser returns `undefined` for absent; `0`/`false` handled correctly; search trim safe.
- **Integration:** browse without filters returns all permitted rows; `is_public=false` filters correctly; `/settings/values` returns only public settings and hits cache on the second call.
- **E2E:** admin list screens load with no query parameters.
- **Load:** `/settings/values` p95 and DB query count (should be near zero after warm-up).

#### F-15 — Map database errors and add transaction boundaries

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-01, F-04 |

**Description.** Translate PostgreSQL error codes into stable API errors and wrap multi-step writes in transactions.

**Problem solved.** Unique, foreign-key, not-null, serialization, and deadlock errors become generic 500s. Registration, password reset, and status/role changes can leave partial state.

**Implementation approach.**

1. Add an error mapper for `23505` (unique → 409), `23503` (FK → 409/422), `23502` (not-null → 422), `23514` (check → 422), `40001`/`40P01` (serialization/deadlock → retry or 503), and connection errors (503).
2. Include a stable `code` and field information where safe; never include SQL text, table names, or constraint names in the response.
3. Add a `withTransaction` helper and use it for:
   - registration (user + session + optional verification token);
   - password reset (password + recovery deletion + session revocation);
   - status/role changes (update + session revocation + audit);
   - destructive admin actions (soft delete + revocation + audit).
4. Use `SELECT ... FOR UPDATE` or optimistic concurrency where lost updates matter.
5. Replace `SELECT`-then-`UPDATE` with `UPDATE ... RETURNING` where the existence check is not needed for authorization.
6. Add retry policy only for transient serialization/deadlock errors, with bounded attempts and jitter. Do not retry non-idempotent writes blindly.

**Security considerations.** Error messages must not leak schema details. Authorization checks must happen inside the transaction when they depend on row state. Audit records should be written in the same transaction when they must not be lost.

**Performance considerations.** Keep transactions short; never call email/HTTP inside them (F-20). Use the same pool; watch for idle-in-transaction. Add `statement_timeout`/`lock_timeout` (F-21).

**Tests.**

- **Unit:** mapper handles each code; unknown errors remain 500; transaction helper rolls back on throw.
- **Integration:** duplicate registration returns 409; invalid FK returns 409/422; simulated failure during registration leaves no user; password reset failure leaves the old password.
- **E2E:** concurrent duplicate requests produce one success and one 409.
- **Load:** transaction duration and pool wait under write-heavy load.

#### F-16 — Redesign Redis cache crypto, TTL, and reconnect behavior

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-09 |

**Description.** Replace bcrypt-based cache integrity with a KDF-derived AES-256-GCM key, add TTL/versioning to the L1 cache, and restore subscriptions when Redis reconnects.

**Problem solved.** Every cache read/write currently runs bcrypt, making the cache slower than the database. The L1 cache never expires, and subscriptions attach only at boot, so Redis recovery does not restore invalidation.

**Implementation approach.**

1. Derive a 32-byte key from `CRYPT0_SECRET` with HKDF-SHA-256 (or require exactly 32 random bytes). Use AES-256-GCM with a random 12-byte IV and store `version:iv:tag:ciphertext`.
2. Remove bcrypt from the cache path entirely. Keep bcrypt for passwords only.
3. Add TTL and a version/etag to L1 entries. On read, treat expired entries as misses and refresh from L2/DB.
4. Attach `ready`/`reconnecting` handlers that re-subscribe to all registered channels. Track subscriptions in a map so re-subscription is deterministic.
5. Add singleflight/lock around cache rebuilds to prevent stampedes across workers.
6. Make cache failures observable and non-fatal: log, increment a metric, fall back to DB. Never serve stale authorization data beyond a defined bound.
7. Validate cache payload shape after decryption; reject malformed entries.

**Security considerations.** AES-GCM provides confidentiality and integrity; do not use unauthenticated modes. Rotate keys with a version prefix and support dual-read during rotation. Do not cache secrets or per-user sensitive data in shared keys. Ensure Redis TLS/auth in production and restrict network access.

**Performance considerations.** AES-GCM is microseconds versus hundreds of milliseconds for bcrypt. Measure hit ratio, latency, and CPU. Set sensible TTLs (settings/route guards 5–15 minutes with pub/sub invalidation). Avoid caching large objects unnecessarily.

**Tests.**

- **Unit:** encrypt/decrypt round trip; tamper detection; TTL expiry; key rotation; subscription registry.
- **Integration:** cache hit avoids DB; invalidation updates all workers; Redis restart restores subscriptions; malformed payload falls back to DB.
- **E2E:** settings change propagates to a second instance within the TTL/SLA.
- **Load:** cache hit latency and CPU; stampede behavior at cold start.

#### F-17 — Add request context, structured logs, redaction, and metrics

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-09 |

**Description.** Introduce request-scoped context, structured JSON logs in production, request/response logging with latency and status, redaction of secrets and PII, and baseline metrics for HTTP, database pool, cache, and auth outcomes.

**Problem solved.** Current logs are pretty-printed in all environments, contain only method and URL, have no correlation ID, and log full error objects. Incidents cannot be reconstructed, and secrets may leak. There are no metrics to detect error-rate, latency, pool, or auth anomalies before users report them.

**Implementation approach.**

1. Add `AsyncLocalStorage` request context: request ID, user ID (when known), route, method, start time.
2. Accept/generate `X-Request-ID` with validation; return it in the response. Do not trust arbitrary long values.
3. Use `pino-http` (or a small custom middleware) with: request ID, method, route template (not raw URL with IDs), status, duration, user ID, error code.
4. Configure Pino: JSON in production, pretty in development, level from env, redact `authorization`, `cookie`, `set-cookie`, `password`, `current_password`, `new_password`, `code`, `token`, `refresh_token`, `secret`, `apiKey`.
5. Replace `console.error` with the logger. Serialize errors with code/message/stack only in non-production.
6. Do not log query strings by default; if needed, allowlist fields.
7. Add log sampling for high-volume success logs if cost requires it, but never sample errors/security events.
8. Expose a `/metrics` endpoint (or push to a collector) with HTTP request count/latency by route template and status, DB pool size/wait, Redis hit/miss/errors, and auth success/failure/rate-limit counters. Use a maintained Prometheus/OpenTelemetry client. Protect or restrict the endpoint.
9. Add OpenTelemetry trace propagation only if the platform supports a collector; start with request-ID correlation and add spans for DB, Redis, and external calls.

**Security considerations.** Redaction must be tested, including nested objects and headers. Logs and metrics are sensitive data: restrict access, set retention, and ship to a controlled sink. Do not log request bodies. Avoid logging email/phone in full; hash or mask where possible. Never use user IDs, emails, or raw URLs as metric labels; that creates unbounded cardinality and can leak identifiers.

**Performance considerations.** Async logging is cheap relative to I/O; avoid synchronous transports. Use a single logger instance. Measure overhead under load (< 1–2 ms p95). Keep metric label sets small and bounded; use histograms for latency and counters for outcomes.

**Tests.**

- **Unit:** request ID generation/validation; redaction of nested secrets; error serializer; metric label allowlist.
- **Integration:** response includes request ID; logs contain status/latency; auth header is redacted; `/metrics` exposes expected series and no user identifiers.
- **E2E:** trace a request across logs by request ID and correlate it with a metric observation.
- **Load:** logging and metrics overhead, disk/network volume, and label cardinality under sustained load.

#### F-18 — Add health, readiness, and graceful shutdown

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | S |
| Dependencies | F-17 |

**Description.** Add unauthenticated liveness and readiness endpoints, dependency checks with timeouts, and correct shutdown behavior for workers and the cluster primary.

**Problem solved.** The only health check is at boot. Orchestrators cannot distinguish a live process from one that cannot serve traffic. Shutdown can drop in-flight requests, and the cluster primary has no signal handling.

**Implementation approach.**

1. `GET /health/live` returns 200 if the event loop is responsive; no dependency checks.
2. `GET /health/ready` checks PostgreSQL with a short timeout and Redis if configured. Return 503 with a minimal status object; do not expose versions, hosts, or stack traces.
3. Cache readiness for a few seconds to avoid probe-driven DB load. Use a dedicated lightweight query (`SELECT 1`).
4. Add SIGTERM/SIGINT handling for both workers and cluster primary:
   - Workers: stop accepting connections, drain in-flight requests with a timeout, close the DB pool and Redis clients, then exit.
   - Primary: forward signals to all workers, wait for worker exits, then exit.
5. Fix `CLUSTER_WORKERS` parsing (F-09) and handle worker crashes with a restart policy and logging.
6. Add startup/readiness probes to the deployment manifests and compose healthchecks.

**Security considerations.** Health endpoints must not leak dependency details or require auth. Rate-limit or restrict them at the edge if exposed publicly. Do not let readiness checks be used for reconnaissance beyond up/down.

**Performance considerations.** Probe frequency × replicas can be significant; cache and use lightweight queries. Readiness must not hold a pool connection for long.

**Tests.**

- **Unit:** readiness aggregator handles DB/Redis failures; shutdown state machine.
- **Integration:** live returns 200 without DB; ready returns 503 when DB is down; in-flight request completes during shutdown.
- **E2E:** orchestrator-style probe sequence during deploy.
- **Load:** probe overhead at scale; no connection starvation.

#### F-19 — Add an append-only audit log

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-04, F-17 |

**Description.** Record security-relevant and administrative events in an append-only audit log with actor, action, target, timestamp, request ID, IP, user agent, and outcome.

**Problem solved.** There is no non-repudiation or forensic trail for logins, failures, password changes, role/status changes, deletions, or settings changes. Incident response and compliance are not possible.

**Implementation approach.**

1. Add an `audit_logs` table: `id` (bigserial/UUID), `occurred_at`, `actor_user_id` (nullable for anonymous), `actor_type`, `action`, `target_type`, `target_id`, `outcome`, `request_id`, `ip`, `user_agent`, `metadata` (JSONB, redacted), `hash_prev`/`hash_self` if tamper-evidence is required.
2. Define a small event taxonomy: `auth.login.succeeded/failed`, `auth.logout`, `auth.password.reset`, `auth.tfa.enabled/disabled`, `user.created/updated/deleted`, `role.updated`, `permission.changed`, `setting.updated`, `session.revoked`.
3. Write audit events in the same transaction as the state change when loss is unacceptable; otherwise use the outbox (F-20).
4. Never store passwords, tokens, OTPs, or full PII. Store IDs and redacted metadata.
5. Provide a restricted read API for auditors/admins with filters and pagination; or ship to an external SIEM and keep the table for short-term retention.
6. Define retention (e.g., 1 year) and legal hold. Protect against updates/deletes with DB permissions and, if needed, triggers.
7. Alert on high-risk events (role change, bypass grant, mass deletion).

**Security considerations.** Audit logs are high-value targets. Restrict write access to the application role, read access to auditors, and prevent tampering. Hash chaining provides evidence but adds complexity; use it only if required. Ensure audit failures do not silently drop events; define fail-open vs fail-closed per event.

**Performance considerations.** Inserts are small; batch/asynchronous writes can reduce overhead but risk loss. Partition by month if volume is high. Index by `(occurred_at)`, `(actor_user_id, occurred_at)`, `(action, occurred_at)`.

**Tests.**

- **Unit:** event builder redacts; hash chain verifies; retention policy.
- **Integration:** login/role change/deletion produce expected events; failed audit write behavior is defined.
- **E2E:** auditor can query events for a user and trace a request ID.
- **Load:** audit write overhead on write-heavy endpoints; partition/retention job.

#### F-20 — Add background jobs and an outbox for email and cleanup

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | L |
| Dependencies | F-08, F-15 |

**Description.** Introduce a durable outbox and a small background worker for email delivery, expired-row cleanup, and other asynchronous work.

**Problem solved.** Email is sent inline (and inside a transaction in password recovery), cleanup is opportunistic, and failures have no retry path. This couples request latency and database health to an external provider.

**Implementation approach.**

1. Add an `outbox_events` table: `id`, `type`, `payload` (JSONB), `status`, `attempts`, `available_at`, `locked_at`, `locked_by`, `last_error`, `created_at`, `processed_at`.
2. Write outbox rows in the same transaction as the business change. A worker polls with `FOR UPDATE SKIP LOCKED`, processes, and marks done/failed with exponential backoff and a max-attempt DLQ.
3. Handlers: send email (recovery, verification, OTP), send SMS if enabled, cleanup expired sessions/recoveries/TFA/refresh tokens, audit export if needed.
4. Make handlers idempotent using an idempotency key/event ID. Do not send duplicate emails on retry if the provider supports idempotency; otherwise accept at-least-once and design templates accordingly.
5. Run the worker in-process for small deployments or as a separate process for scale; document the choice. Ensure it does not run in every cluster worker without locking.
6. Add metrics: queue depth, age, failures, DLQ count; alert on backlog.
7. Provide an admin requeue operation for DLQ events.

**Security considerations.** Outbox payloads may contain PII or tokens; encrypt or minimize them. Do not store raw OTPs/codes longer than needed. Restrict DLQ access. Ensure worker logs redact payloads. Validate event types and payload schemas.

**Performance considerations.** Polling interval and batch size; `SKIP LOCKED` avoids contention. Keep transactions short. Cleanup jobs should delete in batches to avoid long locks and bloat. Use partial indexes on pending rows.

**Tests.**

- **Unit:** backoff calculation; idempotent handler; DLQ transition.
- **Integration:** business transaction writes outbox atomically; worker sends mocked email; failure retries; cleanup removes expired rows only.
- **E2E:** password recovery email arrives via the worker; no email is sent on a rolled-back transaction.
- **Load:** worker throughput and queue lag under burst; cleanup impact on DB.

#### F-21 — Harden database performance and connection management

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-15 |

**Description.** Add explicit pool sizing, query/lock timeouts, production index changes, and a connection strategy that accounts for cluster workers and replicas.

**Problem solved.** Each worker can open 10 connections by default; four workers × two replicas approaches PostgreSQL’s default connection limit. There are no statement or lock timeouts, and migrations create indexes non-concurrently. Long queries or email-in-transaction can exhaust the pool.

**Implementation approach.**

1. Document and enforce a pool budget: `pool_max_per_worker = floor((max_connections - reserve) / total_workers)`. Set `DB_POOL_MAX` accordingly and validate it at boot (F-09).
2. Add `statement_timeout`, `lock_timeout`, and `idle_in_transaction_session_timeout` via pool `options` or per-connection `SET`. Choose values by endpoint class; keep migrations separate.
3. Add `pg_stat_statements`, slow-query logging, and dashboards. Review the top queries by total time and calls.
4. Add missing indexes: `route_guards(role_id)`, unique `(role_id, route)`. Evaluate trigram indexes for search (F-29). Verify existing indexes are used with `EXPLAIN`.
5. Use `CREATE INDEX CONCURRENTLY` for large tables and set `lock_timeout` for migrations. Provide a migration runbook for multi-replica deploys (run once, then deploy).
6. Evaluate PgBouncer in transaction-pooling mode if connection count or churn is high. Note Kysely/pg compatibility and avoid session-level features that break pooling.
7. Tune autovacuum for high-churn tables and monitor bloat.
8. Add a pool-wait metric and alert.

**Security considerations.** Use a least-privilege runtime DB role (DML only, no DDL). Use a separate migration role. Enforce TLS and `scram-sha-256`. Do not expose DB metrics publicly.

**Performance considerations.** Timeouts must be longer than legitimate p99 but short enough to protect the pool. PgBouncer adds a hop; measure. Indexes add write cost; validate with query plans. Avoid over-indexing small tables.

**Tests.**

- **Unit:** pool config math; timeout parsing; index migration SQL.
- **Integration:** a deliberately slow query is cancelled; pool exhaustion returns 503 rather than hanging; migrations run concurrently on a seeded table.
- **E2E:** deploy/migration runbook rehearsal.
- **Load:** connection count, pool wait, slow queries, and p95 under peak; PgBouncer comparison if adopted.

#### F-22 — Add CI quality and supply-chain gates

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | — |

**Description.** Turn CI from “tests only” into a quality gate: lint, typecheck, build, tests with coverage, migration check, dependency audit, static analysis, and container/image scanning.

**Problem solved.** The current workflow does not lint, typecheck, build, measure coverage, audit dependencies, or scan the image. Lint currently fails on vendored `.agents` files, so it cannot be a gate until scoped.

**Implementation approach.**

1. Fix ESLint scope: ignore `.agents/`, `dist/`, `build/`, coverage, and generated files; keep application rules strict. Triage warnings; fail on errors.
2. Add jobs/steps: `npm ci`, `tsc --noEmit`, `npm run build`, `npm run lint`, `npm run test:run -- --coverage`, migration on a fresh database, and a seed idempotency check.
3. Add a Redis service (or explicitly test the fallback path) so cache code is exercised.
4. Add `npm audit --omit=dev` (and a full audit with an exception process), CodeQL/Semgrep, dependency review on PRs, and secret scanning.
5. Pin GitHub Actions to commit SHAs; enable Dependabot/Renovate with grouped updates.
6. Build the production image in CI, scan it (Trivy/Grype), generate an SBOM, and sign it if deploying to a registry.
7. Publish coverage and test reports as artifacts. Set initial thresholds based on measured coverage, then ratchet.
8. Make the main branch protection require these checks.

**Security considerations.** CI has access to secrets; restrict who can modify workflows, use environments for deploy secrets, and avoid `pull_request_target` with untrusted code. Pin actions and images. Do not print secrets. Use least-privilege `GITHUB_TOKEN`.

**Performance considerations.** Cache npm downloads and Docker layers. Split jobs to run in parallel. Keep the PR pipeline under a reasonable duration; move stress/soak tests to nightly.

**Tests.**

- **Unit:** not applicable.
- **Integration:** CI pipeline on a sample PR with an intentional lint/type/test failure.
- **E2E:** release pipeline produces a signed, scanned image and SBOM.
- **Load:** CI smoke load test (F-26) on main/nightly.

#### F-23 — Build a production container and compose profile

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-22 |

**Description.** Replace the Ubuntu development image with a multi-stage, non-root runtime image that contains only production dependencies and has a defined command, healthcheck, and ignore file.

**Problem solved.** The current Dockerfile runs as root, installs Git/OpenCode/nodemon/npm-check-updates, configures SSH with host verification disabled, has no `CMD`, and has no `.dockerignore`. The compose file has no `env_file` and names the image “mysql.”

**Implementation approach.**

1. Multi-stage build: `node:24-bookworm-slim` (or distroless) builder installs dev deps and builds; runtime copies `dist`, `node_modules` production-only, and package metadata.
2. Run as a non-root user with a read-only filesystem where possible. Drop Linux capabilities. Set `NODE_ENV=production`.
3. Add `CMD ["node", "dist/src/index.js"]`, `EXPOSE`, `STOPSIGNAL SIGTERM`, and a `HEALTHCHECK` hitting `/health/live`.
4. Add `.dockerignore` for `.git`, `node_modules`, `dist`, tests, docs, `.env*`, coverage, and local artifacts.
5. Remove SSH configuration, OpenCode, global tools, and `StrictHostKeyChecking no`.
6. Pin the base image by digest; scan the image (F-22).
7. Update `compose.yml`: `env_file`, healthchecks, dependency ordering, a non-root user, and optional PostgreSQL/Redis services for local development. Rename the service/image away from “mysql.”
8. Document build, run, migration, and secret-injection steps.

**Security considerations.** No secrets in image layers. Do not run as root. Keep the image minimal to reduce attack surface. Use a read-only root filesystem and a tmp volume if the app writes files. Verify TLS certificates in the runtime image.

**Performance considerations.** Smaller images pull faster; production-only dependencies reduce memory and startup time. Multi-stage caching speeds builds.

**Tests.**

- **Unit:** not applicable.
- **Integration:** container starts, passes healthcheck, serves an API request, and handles SIGTERM gracefully.
- **E2E:** compose-based smoke test with PostgreSQL and Redis.
- **Load:** image runs the smoke load profile without errors.

#### F-24 — Publish an OpenAPI contract and correct documentation

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-14 |

**Description.** Add a machine-readable OpenAPI 3.1 contract for every endpoint, generate or validate it in CI, and correct the README’s endpoint/pagination examples.

**Problem solved.** Integrators rely on drifting prose. The README uses the wrong login path and `limit` instead of `per_page`, and there is no contract test to catch breaking changes.

**Implementation approach.**

1. Choose a source of truth: hand-written `openapi.yaml` validated in CI, or generated from Joi/Zod schemas. Avoid maintaining both independently.
2. Document: auth scheme, error envelope, pagination parameters, idempotency headers, rate-limit headers, and all request/response schemas.
3. Add `spectral` linting and a contract test that boots the app and validates representative responses.
4. Publish docs (Redoc/Scalar/Swagger UI) behind auth or in a docs site; do not expose an interactive console in production without protection.
5. Fix the README: `/api/v1/auth/login`, `per_page`, correct TFA status, correct Redis behavior, and the compose image name.
6. Add examples for curl/HTTP clients and a changelog for breaking changes.

**Security considerations.** Do not include real secrets or internal hostnames in examples. Protect interactive docs. Ensure the spec does not advertise deprecated insecure endpoints.

**Performance considerations.** Serving static docs is cheap; keep it out of the API process if possible.

**Tests.**

- **Unit:** schema validation; example validation.
- **Integration:** contract tests for success and error shapes; pagination parameter behavior.
- **E2E:** a generated client can complete login → browse → logout.
- **Load:** not applicable.

#### F-25 — Build the regression, isolation, and coverage test program

| Field | Value |
| --- | --- |
| Priority | P1 |
| Status | **Implemented** |
| Complexity | L |
| Dependencies | F-01–F-10 |

**Description.** Add regression tests for every P0 defect, isolate integration tests, add deterministic fixtures, set coverage thresholds, and introduce E2E and security test suites.

**Problem solved.** The current suite is broad but misses the exact broken paths. Integration tests share one database and depend on prior seeds, so order and parallelism are fragile. There are no E2E, authorization-matrix, or security regression tests.

**Implementation approach.**

1. **Regression first:** write failing tests for F-01–F-10 before fixing them. Keep them as permanent guards.
2. **Isolation:** use a per-test transaction rollback where possible, or a dedicated schema/database per worker. Seed only the data each test needs. Remove reliance on global seed state.
3. **Factories:** add small builders for users, roles, sessions, settings, and route guards. Avoid copying fixtures.
4. **Coverage:** measure statements/branches/functions/lines; set an initial floor and ratchet. Exclude generated code, migrations, and type-only files. Do not chase 100%.
5. **E2E:** add a small suite (Playwright or Supertest against a composed stack) for registration → login → TFA → account → logout, admin CRUD, and password reset.
6. **Security tests:** authorization matrix per role, IDOR attempts, mass assignment, token tampering, expired/revoked sessions, rate-limit behavior, and input validation.
7. **Contract tests:** OpenAPI response validation (F-24).
8. **Mutation testing (optional):** run Stryker on critical auth/authorization modules quarterly to find weak assertions.
9. **Flakiness:** quarantine and fix flaky tests; track pass rate; avoid arbitrary sleeps.
10. **CI:** run unit and integration on every PR; E2E on PR/main; nightly full suite.

**Security considerations.** Tests must not use production secrets or real email/SMS. Use mocked providers and ephemeral databases. Do not commit real PII. Ensure test users cannot access production.

**Performance considerations.** Parallelize where safe; keep the PR suite under a sensible duration. Use database templates or snapshots to speed setup.

**Tests.** This feature is the test program; its acceptance is coverage of the matrix in Section 9 plus a green, deterministic CI run.

#### F-26 — Establish a load and performance testing program

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-21, F-25 |

**Description.** Turn the existing Artillery configs into a repeatable performance program with realistic scenarios, seeded data, mocked email, thresholds, and trend reporting.

**Problem solved.** Configs exist but were not run for this assessment, and there is no evidence they match real traffic, include auth flows, or gate regressions. Without baselines, performance claims are guesses.

**Implementation approach.**

1. Define scenarios from Section 7.7: login/logout, authenticated browse, settings values, admin writes, recovery/TFA with mocked email.
2. Seed a representative dataset (e.g., 100k users, 10k route guards, realistic role distribution) in a staging-like environment.
3. Configure thresholds for p95/p99, error rate, and pool wait. Fail the run when thresholds are exceeded.
4. Capture server metrics (CPU, memory, event-loop lag, DB connections, slow queries, Redis latency) alongside Artillery results.
5. Run smoke on PR/main, baseline nightly, stress weekly, soak monthly. Store results and chart trends.
6. Compare before/after for performance-sensitive changes. Require a load-test note in PRs that touch auth, DB queries, or caching.
7. Document environment parity and caveats; never compare results across different hardware/dataset sizes without normalization.

**Security considerations.** Use synthetic data only. Do not send real email/SMS. Isolate the load environment from production. Rate limits must be configured so tests exercise them intentionally, not accidentally.

**Performance considerations.** Load generators must not be the bottleneck; use multiple workers and monitor them. Warm up caches and connections. Separate DB and app metrics.

**Tests.** Acceptance is a documented baseline, thresholds enforced in CI/nightly, and at least one regression caught or ruled out.

#### F-27 — Add object-level and field-level authorization

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | **Partially implemented** |
| Complexity | L |
| Dependencies | F-13 |

**Description.** Move beyond route-level permissions: enforce ownership/tenant scoping for user-facing resources and field-level restrictions for privileged fields such as `role_id`, `status`, and bypass flags.

**Problem solved.** A role granted `users:view` can view every user, and `users:update` can change roles/status. Route guards alone cannot express “a customer may read only their own orders” or “only a super-admin may grant bypass.”

**Implementation approach.**

1. Define an authorization policy layer with `can(actor, action, resource)` and explicit ownership/tenant rules.
2. Apply it in services, not only routes, so every entry point is covered.
3. Add field-level allowlists per role/action for user create/update. Reject privileged fields rather than silently stripping them (or strip and audit).
4. Add tenant/owner columns only if a real multi-tenant requirement exists; do not add tenant IDs speculatively.
5. Add an authorization test matrix: role × action × resource ownership × expected result.
6. Log denials with policy decision context.
7. Consider OPA/Cedar only if policy complexity justifies it; a typed in-code policy is simpler for this codebase.

**Security considerations.** Default deny. Never trust client-supplied owner/tenant IDs. Check authorization after loading the resource and inside the transaction for state-changing operations. Avoid leaking resource existence through 403 vs 404 differences; choose a consistent policy.

**Performance considerations.** Policy checks should be in-memory and cheap; resource loads should use indexed owner/tenant columns. Avoid N+1 permission lookups.

**Tests.**

- **Unit:** policy decisions for each role/ownership combination; field allowlists.
- **Integration:** IDOR attempts return 404/403 consistently; customer cannot escalate role; admin can.
- **E2E:** multi-user scenario with ownership boundaries.
- **Load:** policy overhead on hot read paths.

#### F-28 — Add idempotency and retry-safe writes

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-15, F-20 |

**Description.** Support `Idempotency-Key` on unsafe POST endpoints and make retryable operations safe under client/network retries.

**Problem solved.** Registration, password recovery, admin creation, and payment-like writes can be duplicated by retries. The outbox reduces email duplication but does not protect API writes.

**Implementation approach.**

1. Add an `idempotency_keys` table: `key`, `user_id`, `route`, `request_hash`, `status`, `response_status`, `response_body`, `created_at`, `expires_at`, `locked_at`.
2. Middleware for selected POSTs: require/accept the header, reject reuse with a different payload (409/422), return the stored response for completed requests, and return 409/425 for in-progress duplicates.
3. Scope keys per user/tenant and route; expire after 24 hours; clean up on a schedule.
4. Combine with transactions: reserve the key, execute, store the response, commit. Handle crashes with a lease/timeout.
5. Document which endpoints support idempotency and which are naturally idempotent (PUT/DELETE).
6. Do not store sensitive response bodies longer than needed; redact or store only the necessary fields.

**Security considerations.** Keys must not allow cross-user replay. Hash the request body with a canonical serialization. Protect against key guessing/enumeration by scoping and randomizing. Do not let a stored error response be replayed indefinitely if the underlying condition changed; define the policy.

**Performance considerations.** One extra indexed lookup/write per idempotent request. Cleanup job and TTL. Avoid holding locks for the entire request if possible; use a lease.

**Tests.**

- **Unit:** canonical hashing; conflict detection; expiry.
- **Integration:** duplicate POST with the same key returns the same response; different payload returns 409; concurrent duplicates produce one write.
- **E2E:** client retry after timeout does not duplicate a user/email.
- **Load:** idempotency table growth and lookup latency.

#### F-29 — Add trigram search indexes and pagination consistency

| Field | Value |
| --- | --- |
| Priority | P2 |
| Status | **Implemented** |
| Complexity | M |
| Dependencies | F-21, F-24 |

**Description.** Add `pg_trgm` GIN indexes for leading-wildcard search and standardize pagination across endpoints.

**Problem solved.** User search uses `LIKE '%keyword%'` across six columns without trigram indexes; admin tables use offset pagination; parameter names are inconsistent (`limit` vs `per_page`).

**Implementation approach.**

1. Enable `pg_trgm` and add GIN indexes for the columns actually searched (`users.first_name`, `last_name`, `username`, `email`, `phone`, maybe `address`). Consider a generated `search_text` column to reduce index count.
2. Rewrite search to use a single indexed expression or `ILIKE` with trigram support; verify with `EXPLAIN`.
3. Set a minimum search length and cap the number of terms to avoid expensive queries.
4. Standardize pagination: cursor/keyset for large tables (users), offset for small admin tables with a documented cap. Use `page`/`per_page` consistently; accept `limit` only as a deprecated alias if needed.
5. Add stable sort keys and tie-breakers for cursor pagination.
6. Return pagination metadata consistently (`next_cursor`, `has_more`, `total` only where cheap).
7. Add query timeouts for search endpoints (F-21).

**Security considerations.** Search must respect authorization/tenant scoping. Do not allow arbitrary column selection. Escape LIKE wildcards (already done). Avoid search-based enumeration of sensitive fields.

**Performance considerations.** Trigram indexes speed `%term%` but increase write/storage cost. Measure index bloat and vacuum. Use `EXPLAIN (ANALYZE, BUFFERS)` on representative data. Cap result pages.

**Tests.**

- **Unit:** search term sanitization; pagination parser.
- **Integration:** search returns expected matches with special characters; deep pagination is stable; invalid params return 400.
- **E2E:** admin search UX with large datasets.
- **Load:** search p95 on 100k+ rows with and without indexes.

#### F-30 — Optional identity enhancements: TOTP, WebAuthn, SSO

| Field | Value |
| --- | --- |
| Priority | P3 |
| Status | **Deferred (P3)** |
| Complexity | L |
| Dependencies | F-07, F-11 |

**Description.** Add stronger phishing-resistant authentication options only when a product or compliance requirement justifies them: TOTP, WebAuthn/passkeys, and enterprise SSO (OIDC/SAML).

**Problem solved.** Email OTP inherits email-account risk and is weaker than phishing-resistant factors. Enterprise customers may require SSO. This is not a current defect; it is a product-dependent enhancement.

**Implementation approach.**

1. **TOTP:** add an authenticator app enrollment flow with a QR code, secret encrypted at rest, recovery codes, clock-skew tolerance, and replay prevention.
2. **WebAuthn:** support registration/authentication ceremonies, store credential IDs/public keys/sign counters, and require user verification as appropriate. Use a maintained library; do not implement crypto manually.
3. **SSO:** integrate an OIDC provider first; map claims to roles carefully; support Just-in-Time provisioning only with domain verification; consider SAML only if a customer requires it.
4. Keep email OTP as a fallback and recovery path. Require re-authentication to add/remove factors.
5. Add step-up authentication for sensitive actions (role changes, bypass grants, bulk deletion).
6. Audit enrollment, removal, and login method.

**Security considerations.** Phishing resistance is the main benefit; do not weaken it with insecure fallbacks. Protect against credential ID enumeration. Validate redirect URIs and state/nonce for OIDC. Do not auto-link accounts by unverified email. Encrypt TOTP secrets with a KMS-managed key. Rate-limit all ceremonies.

**Performance considerations.** WebAuthn verification is cheap; SSO adds a redirect round trip and external dependency. Cache JWKS with rotation handling.

**Tests.**

- **Unit:** TOTP window/replay; WebAuthn challenge validation; OIDC state/nonce/claims mapping.
- **Integration:** enroll/authenticate/remove each factor; SSO login maps roles; fallback works.
- **E2E:** browser WebAuthn flow (virtual authenticator); SSO with a mock IdP.
- **Load:** SSO callback and JWKS caching under login bursts.

---

## 9. Testing Strategy

### 9.1 Current Test Inventory

| Level | Current state | Evidence |
| --- | --- | --- |
| Unit | 34 colocated `src/**/*.spec.ts` files | Repository inventory |
| Integration | 5 Supertest suites: account, login, register, password recovery, TFA | `tests/integration/` |
| Test runner | Vitest with `globals: true`; includes `src/**/*.{test,spec}.ts` and `tests/integration/**/*.{spec,test}.ts` | `vitest.config.ts` |
| Global setup | Runs `migrateToLatest()` before any test file; closes the DB after all | `tests/integration/setup.ts` |
| Isolation | Shared database; npm scripts force `--no-file-parallelism` | `package.json`, `AGENTS.md` |
| Seed dependency | Integration suites assume required roles/settings exist; global setup does not seed | Setup and tests |
| Load | Artillery smoke/default/stress/soak configs and a runner script | `tests/load/` |
| CI | Installs, migrates, seeds, runs tests against a PostgreSQL service; Redis host is empty | `.github/workflows/test.yml` |
| Coverage | Not configured as a gate | No coverage thresholds observed |

**Important:** the test suite was **not run** for this report. The inventory describes what exists, not whether it currently passes.

### 9.2 What the Current Suite Does Well

- It exercises real HTTP routes through Supertest and a real PostgreSQL database, which catches wiring and SQL errors that mocked unit tests miss.
- It covers the main auth flows: login, register, account, password recovery, and TFA.
- It mocks SendGrid in password-recovery tests, avoiding real email.
- It has broad unit coverage of services, controllers, middleware, and validators.
- It uses a real migration run, so schema drift is more likely to surface.

### 9.3 What the Current Suite Misses

1. **Regression tests for the verified P0 defects.** No test asserts that duplicate registration returns 409, that account updates return a usable session-bound token, that expired sessions are rejected, or that suspended users cannot log in.
2. **Authorization matrix tests.** There is no test that logs in as each role and asserts allowed/denied routes across the API.
3. **Isolation.** Shared database state makes tests order-dependent and prevents safe parallelism. The global setup migrates but does not seed, so tests rely on external seed state.
4. **E2E flows.** No browser/client-level test covers registration → verification → login → TFA → account → logout, or admin CRUD.
5. **Security tests.** No tests for IDOR, mass assignment, token tampering, rate limiting, enumeration, or header/CORS behavior.
6. **Contract tests.** No OpenAPI validation of responses.
7. **Failure-path tests.** Transaction rollback, email-provider failure, Redis outage, pool exhaustion, and migration failure are largely untested.
8. **Coverage gates.** No measured baseline or threshold.
9. **Load integration.** Artillery configs exist but are not part of CI and have no recorded baseline.
10. **Determinism.** Time-dependent OTP/recovery tests can be flaky; arbitrary sleeps and shared state should be replaced with clock control and explicit fixtures.

### 9.4 Test Levels and Responsibilities

| Level | Scope | Speed | What it must prove |
| --- | --- | --- | --- |
| Unit | Pure functions, validators, services with mocked repositories, middleware in isolation | Milliseconds | Branch logic, edge cases, error mapping, policy decisions |
| Integration | Express app + real PostgreSQL + mocked external providers | Seconds | SQL correctness, transactions, auth/session behavior, HTTP contracts |
| Contract | OpenAPI schema vs. real responses | Seconds | No breaking shape changes; documented errors/pagination |
| E2E | Full stack (app + DB + Redis + mocked email) through a client | Tens of seconds | Critical user journeys and cross-module behavior |
| Security | Targeted abuse/misuse cases | Seconds–minutes | Authorization boundaries, token lifecycle, rate limits, input handling |
| Load | Staging-like environment under synthetic traffic | Minutes–hours | Latency/throughput/error budgets, pool/connection behavior |
| Migration | Fresh DB + upgrade path + seed idempotency | Seconds–minutes | Schema correctness and deploy safety |

### 9.5 Required Test Matrix

The following matrix defines the minimum coverage for the P0/P1 work. “I” = integration, “U” = unit, “E” = E2E, “S” = security, “L” = load.

| Area | Required scenarios | Levels |
| --- | --- | --- |
| Registration | Valid registration; duplicate username/email/phone → 409; weak password → 422; unknown fields stripped; concurrent duplicates → one success; session created atomically | U, I, S, L |
| Login | Valid/invalid credentials; suspended/deactivated/pending rejected; lockout threshold and expiry; success resets counters; generic errors; rate limit → 429 | U, I, S, L |
| Sessions | Valid session accepted; expired session rejected; mismatched `uid`/`tid` rejected; logout revokes; logout-all revokes; status/role/password change revokes; cleanup removes expired rows | U, I, E, S |
| Tokens | Claims present (`tid`, `uid`, `tfa`, `rol`, `bpa`, `iss`, `aud`, `jti`); tampered signature rejected; wrong algorithm rejected; expired JWT rejected; refresh rotation/reuse detection | U, I, S |
| Authorization | Role × route matrix; missing guard denies; bypass only for authorized role; role change takes effect; duplicate route guard rejected; unknown role denies | U, I, S |
| Account | Profile update returns usable token; password change revokes other sessions; email/phone change resets verification; cannot change privileged fields without permission | U, I, E, S |
| TFA | Policy resolution; enrollment sets `has_tfa`; login returns restricted token; validate upgrades; wrong code increments; threshold sets expiry; new OTP resets; single-use; rate limit | U, I, E, S |
| Password recovery | Constant response for known/unknown; code expiry/tries; atomic reset; sessions revoked; phone behavior; email sent outside transaction; rate limit | U, I, E, S, L |
| Users admin | Create/update/delete; correct `ignoreId`; role validation; soft delete; role deletion restricted; browse filters; cursor pagination | U, I, E, S |
| Settings | CRUD; typed values; cache invalidation; `/values` public/cached; absent filters; search optional | U, I, L |
| Roles/guards | CRUD; unique `(role_id, route)`; browse filters; delete restrictions; seed correctness | U, I, E |
| Validation | Scalar uniqueness; composite uniqueness; exists; null/empty; identifier allowlist; mass assignment | U, I, S |
| Errors | 23505/23503/23502/23514/40001/40P01 mapping; unknown → 500 without leakage; transaction rollback | U, I |
| Cache | Encrypt/decrypt; tamper; TTL; invalidation; Redis restart; malformed payload; fallback | U, I, E, L |
| Config | Required secrets; ranges; production constraints; `NaN` workers; wildcard CORS rejection | U, I |
| Health/ops | Live/ready; DB down; Redis down; graceful shutdown; request ID; redaction; metrics | U, I, E |
| Audit | Event taxonomy; redaction; transaction coupling; read API authorization; retention | U, I, S |
| Jobs/outbox | Atomic write; retry/backoff; DLQ; idempotency; cleanup | U, I, E, L |
| Docs/contract | OpenAPI lint; response validation; pagination/auth examples | Contract |
| Load | Baseline, stress, spike, soak; thresholds; pool/Redis behavior | L |

### 9.6 Isolation and Determinism

**Recommended approach**

1. **Per-test transaction rollback** for integration tests that do not need multiple connections. Start a transaction in `beforeEach`, pass it to repositories via `DatabaseExecutor`, and roll back in `afterEach`. This is fast and deterministic.
2. **Dedicated schema/database per worker** for tests that need real commits (e.g., transaction behavior, outbox workers, concurrent sessions). Create a template database, clone it per worker, and drop it afterward.
3. **Explicit fixtures/factories** for every test: create only the roles, settings, and users the test needs. Do not depend on global seeds.
4. **Deterministic time** with fake timers or an injectable clock for OTP/recovery/lockout tests.
5. **Mocked external providers** (SendGrid, SMS) with assertions on the outbox/queue, not sleeps.
6. **Stable IDs** or assertions that do not depend on sequence values.
7. **No shared mutable state** between test files; no `--no-file-parallelism` as a permanent workaround.
8. **Cleanup** of Redis keys and outbox rows per test.

**Acceptance:** integration tests pass in random order and in parallel workers; a fresh database plus migrations is sufficient to run the suite; no test requires a prior `db:seed`.

### 9.7 Coverage Targets

Coverage is a diagnostic, not a goal by itself. Suggested initial gates:

| Scope | Statements | Branches | Notes |
| --- | --- | --- | --- |
| Global | 70% | 60% | Ratchet upward; exclude migrations/types/generated |
| Auth/session/authorization | 90% | 85% | Critical security logic |
| Validation/error mapping | 90% | 85% | Input and failure paths |
| Repositories | 80% | 70% | Integration-heavy |
| Controllers/middleware | 80% | 70% | Include error paths |
| Jobs/cache | 80% | 70% | Include failure/retry paths |

Do not merge code that lowers the threshold. Review uncovered critical branches manually; a high global number can hide an untested auth branch.

### 9.8 Security Testing

**In the test suite**

- Authorization matrix per role and ownership.
- IDOR attempts against `/users/:id`, `/account`, settings, roles, and route guards.
- Mass assignment attempts (`role_id`, `status`, `is_bypass_authorization`, `password`).
- Token tampering: signature, algorithm, `tid`, `uid`, `tfa`, `bpa`.
- Expired/revoked session and JWT behavior.
- Rate-limit thresholds and `Retry-After`.
- Account enumeration through registration, login, recovery, and verification.
- CORS allowlist and preflight behavior.
- Input validation: oversized bodies, wrong types, arrays where strings are expected, null bytes, Unicode.
- Error responses: no stack traces, SQL, or secrets.

**Outside the test suite**

- SAST (CodeQL/Semgrep) in CI.
- Dependency audit and container scan (F-22).
- DAST against staging (ZAP or equivalent) before major releases.
- Annual or pre-launch penetration test by an independent party.
- Secret scanning and history review.
- Threat-model review for new features.

**Rules**

- Never test against production.
- Use synthetic accounts and mocked providers.
- Do not commit exploit payloads that include real data.
- Triage findings with severity and an owner; track to closure.

### 9.9 Load and Performance Testing

Follow Section 7.7. Minimum acceptance:

- A documented baseline exists for login, authenticated browse, settings values, and admin writes.
- Thresholds are enforced in CI (smoke) and nightly (baseline).
- Stress testing identifies the saturation point and the failure mode (429/503, not a hang).
- Soak testing shows no unbounded memory, connection, or table growth.
- Redis outage and DB pool exhaustion are tested deliberately, not just assumed.
- Results are stored with environment metadata and compared over time.

### 9.10 CI Cadence

| Trigger | Suites |
| --- | --- |
| Pull request | Lint, typecheck, build, unit, integration, contract, security regression, smoke load (optional) |
| Main merge | All PR checks + E2E + migration/seed check + image build/scan |
| Nightly | Full integration, E2E, baseline load, dependency audit |
| Weekly | Stress load, DAST against staging |
| Monthly | Soak, restore drill, dependency/container review, mutation testing (optional) |
| Release | Full suite + migration rehearsal + rollback rehearsal |

### 9.11 Test Data and Privacy

- Use generated synthetic data; never copy production PII.
- Seed credentials must be random or environment-provided, never a shared weak default (F-05/F-09).
- Mask emails/phones in logs and test reports.
- Keep test databases isolated and destroyed after runs.
- Do not commit `.env` files, tokens, or provider keys.
- If production-like data is required for performance testing, anonymize it irreversibly and obtain approval.

### 9.12 Definition of Done for Any Feature

A feature is not done until:

- [ ] Acceptance criteria are written and demonstrably met.
- [ ] Unit tests cover success, validation, and failure branches.
- [ ] Integration tests cover the HTTP contract and database behavior.
- [ ] Authorization and negative tests exist where relevant.
- [ ] Error mapping is defined and tested.
- [ ] Logs/audit events are defined and redacted.
- [ ] Performance impact is considered; a load test is added for hot paths.
- [ ] Documentation/OpenAPI is updated.
- [ ] Migration is reversible or has a documented rollback.
- [ ] CI is green, including lint/typecheck/build/coverage/security gates.
- [ ] No new secrets, debug code, or dead configuration are introduced.

---

## 10. Recommended Architecture and Technology Stack

### 10.1 Architectural Principles

1. **Keep the modular monolith.** The current size and team shape do not justify microservices. A single deployable with clear module boundaries is cheaper to operate, test, and reason about.
2. **Make invariants explicit.** Authentication, session validity, authorization, and data integrity should be enforced in one place each, not re-implemented per route.
3. **Prefer the database for correctness.** Unique constraints, foreign keys, transactions, and check constraints are the final authority; application validation improves UX but does not replace them.
4. **Fail closed on security decisions.** Missing session, role, permission, or configuration must deny access or stop boot, not degrade silently.
5. **Keep external I/O out of transactions.** Email, SMS, webhooks, and other network calls belong in an outbox/worker.
6. **Observe the system.** A production service needs request IDs, structured logs, metrics, traces, health checks, and audit events.
7. **Add dependencies deliberately.** Prefer platform features and small, maintained libraries. Do not add a framework, queue, or service mesh without a concrete requirement.

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
                 |                                         |
                 |  HTTP middleware                        |
                 |   - request ID, logging, redaction      |
                 |   - CORS allowlist, Helmet, limits      |
                 |   - authn (JWT + session + status)      |
                 |   - authz (role/permission + policy)    |
                 |   - validation, rate limits             |
                 |                                         |
                 |  Modules                                |
                 |   auth | users | system                 |
                 |   account | audit | jobs (optional)    |
                 |                                         |
                 |  Services -> Repositories -> Kysely     |
                 +---------+-------------------+-----------+
                           |                   |
                           v                   v
                 +---------+------+   +--------+---------+
                 | PostgreSQL     |   | Redis (optional) |
                 | - app data     |   | - cache          |
                 | - sessions     |   | - rate limits    |
                 | - outbox       |   | - pub/sub        |
                 | - audit        |   +------------------+
                 +---------+------+
                           |
                           v
                 +---------+------+
                 | Backup / PITR  |
                 +----------------+

                 +--------------------+
                 | Worker process     |
                 | - outbox/email     |
                 | - cleanup jobs     |
                 | - audit export     |
                 +--------------------+
```

**Deployment shape:** one API image, optionally one worker image built from the same code with a different command. PostgreSQL and Redis are managed services or separately operated. A reverse proxy terminates TLS and enforces edge limits. Horizontal scaling is stateless; sessions live in PostgreSQL, rate limits/cache in Redis.

### 10.3 Module Boundaries

| Module | Owns | Must not own |
| --- | --- | --- |
| `auth` | Credentials, login, sessions, tokens, TFA, recovery | User profile fields beyond auth needs; role definitions |
| `users` | User records, profile, admin user CRUD, account | Route permission definitions; session storage |
| `system` | Settings, roles, route guards, cache events | User credentials; email delivery internals |
| `audit` (new) | Append-only security/admin events | Business logic decisions |
| `jobs` (new) | Outbox, email/SMS delivery, cleanup | HTTP request handling |
| `shared` | DB, Redis, validation, errors, logging, security primitives | Module-specific business rules |

**Rules**

- Controllers do HTTP only; services own use cases; repositories own SQL.
- Cross-module calls go through service interfaces, not another module’s repository.
- Shared utilities must not import module services (avoid cycles).
- Each module exposes a small public surface; internal types stay internal.
- The container (or per-module factory) is the only composition root. Do not instantiate services inside routes.

### 10.4 Cross-Cutting Components

| Component | Responsibility | Implementation guidance |
| --- | --- | --- |
| Request context | Request ID, actor, route, timing | `AsyncLocalStorage` + middleware |
| Authentication | Verify JWT, load live session, load status/version | One `AuthenticationService.authenticate()` path |
| Authorization | Route permission + object/field policy | `AuthorizationService.can()`; deny by default |
| Validation | Schema + database uniqueness/existence | Joi schemas; DB constraints as authority |
| Error handling | Stable codes, safe messages, DB mapping | Central mapper; no schema/SQL leakage |
| Rate limiting | Layered buckets for sensitive endpoints | Redis atomic counters + local fallback |
| Audit | Security/admin event trail | Append-only table or SIEM; redacted metadata |
| Outbox/jobs | Durable async work | `FOR UPDATE SKIP LOCKED`, retries, DLQ |
| Cache | Settings/route guards, rate limits | AES-GCM, TTL, pub/sub invalidation |
| Observability | Logs, metrics, traces, health | JSON logs, Prometheus/OTel, probes |
| Configuration | Typed env, secrets, fail-fast | Schema validation at boot |

### 10.5 Technology Decisions

| Concern | Current | Recommendation | Rationale |
| --- | --- | --- | --- |
| HTTP framework | Express 5 | **Keep** | Stable, familiar, sufficient; no need for a rewrite |
| Language | TypeScript strict | **Keep** | Strong safety; keep `strict`, add `noUncheckedIndexedAccess` if feasible |
| DB access | Kysely 0.29 | **Keep** | Typed SQL, transactions, no ORM magic |
| Database | PostgreSQL | **Keep** | Correctness features, indexing, JSONB, PITR |
| Cache | Redis + ioredis | **Keep, optional** | Useful for rate limits/cache; must degrade safely |
| Validation | Joi | **Keep** | Already integrated; avoid a second schema system |
| Auth | JWT + DB sessions | **Keep, repair** | Good model; add refresh tokens and standard claims |
| Password hash | bcrypt + pepper | **Keep or migrate to Argon2id** | bcrypt acceptable; Argon2id is OWASP’s first choice for new systems |
| Logging | Pino | **Keep, configure** | Add `pino-http`, JSON prod, redaction |
| Metrics/traces | None | **Add OpenTelemetry/Prometheus** | Needed for production operations; keep instrumentation minimal |
| API contract | None | **Add OpenAPI 3.1** | Integrator confidence and contract tests |
| Jobs/queue | None | **Add PostgreSQL outbox first** | Avoid a new broker; SKIP LOCKED is sufficient at this scale |
| Email | SendGrid | **Keep behind an interface** | Already abstracted; move to outbox |
| Testing | Vitest + Supertest | **Keep, extend** | Add isolation, coverage, E2E, contract tests |
| Container | Ubuntu dev image | **Replace with multi-stage slim/distroless** | Security, size, reproducibility |
| CI | Tests only | **Expand** | Quality and supply-chain gates |
| Reverse proxy | External/unspecified | **Document and configure** | TLS, timeouts, IP trust, edge limits |
| Secrets | `.env` | **Secret manager in production** | Rotation, access control, audit |

**Deliberately not recommended**

- A DI framework: manual wiring is small and explicit; fix duplication instead.
- An ORM: Kysely already provides typed SQL; an ORM would add complexity.
- GraphQL: no demonstrated client need; REST + OpenAPI is sufficient.
- Kafka/RabbitMQ: the outbox table covers current volume; add a broker only when throughput/latency requires it.
- Microservices: operational cost outweighs benefits at this scale.
- A separate auth service: the current module is sufficient if repaired.
- Multi-tenancy: add only with a real tenant requirement and a data-isolation design.
- A full rewrite: the foundation is usable; repair and harden.

### 10.6 Data Architecture

**Schema changes to plan**

| Change | Purpose | Notes |
| --- | --- | --- |
| `users.role_id` FK → `RESTRICT` | Prevent user deletion via role deletion | Backfill orphans first |
| `users.deleted_at` usage | Soft delete | Ensure all reads filter it |
| `users.authorization_version` | Fresh authorization | Increment on role/status/permission change |
| `refresh_tokens` | Rotating refresh | Hash tokens; family/reuse detection |
| `verification_tokens` | Email/phone verification | Hash tokens; expiry/consumption |
| `outbox_events` | Durable async work | Status/attempts/available_at |
| `audit_logs` | Security/admin trail | Append-only; partition if needed |
| `idempotency_keys` | Retry safety | TTL and scoped keys |
| `route_guards` unique/index | Integrity/performance | Unique `(role_id, route)`, index `role_id` |
| `authentication_tokens.expired_at` NOT NULL | Session correctness | Backfill; default at creation |
| `settings`/`roles` browse indexes | Admin performance | Only if query plans justify |

**Migration strategy**

- Every migration has a forward path and a documented rollback or compensating action.
- Use `CREATE INDEX CONCURRENTLY` for large tables; run outside a transaction when required.
- Separate schema migration from data backfill; make backfills idempotent and batched.
- Run migrations once per deploy, before new instances receive traffic. Do not let every replica race.
- Test migrations on a production-like snapshot and measure lock time.
- Keep the static migration registry; do not rely on filesystem discovery.
- Seeds must be idempotent and safe to re-run; production seeds should be minimal and explicit.

### 10.7 API Conventions

| Concern | Convention |
| --- | --- |
| Base path | `/api/v1` |
| Auth | `Authorization: Bearer <access token>`; refresh via `HttpOnly` cookie |
| Content type | `application/json; charset=utf-8` |
| Success | Resource representation or `{data, meta}` for lists |
| Errors | `{code, message, fields?}`; stable machine-readable `code` |
| Validation | `422` with field errors; `400` for malformed requests |
| Duplicate | `409` |
| Unauthenticated | `401` with generic message |
| Forbidden | `403` or `404` for hidden resources, consistently |
| Rate limited | `429` + `Retry-After` |
| Pagination | `page`/`per_page` for admin lists; cursor for users; document both |
| Idempotency | `Idempotency-Key` on selected POSTs |
| Request ID | `X-Request-ID` accepted/returned |
| Versioning | URL major version; additive changes within a version; deprecation policy |
| Dates | ISO 8601 UTC |
| Null vs. absent | Define per field; do not use `null` for “unchanged” |

### 10.8 Configuration and Secrets

- One typed configuration module validated at boot.
- Development uses `.env`; production uses environment variables injected by the platform/secret manager.
- Secrets are never committed, logged, or baked into images.
- Support rotation for JWT/crypto keys with a key ID/version.
- Separate credentials per environment and per role (runtime vs. migration).
- Document every variable, its type, default, and whether it is required in production.
- Fail startup if a required value is missing or invalid.

### 10.9 Deployment Topology

**Minimum production topology**

- 2 API replicas behind a load balancer/reverse proxy.
- Managed PostgreSQL with TLS, automated backups, PITR, and a connection budget.
- Managed Redis with TLS/auth if caching/rate limiting is enabled; otherwise run in DB-only mode with local limits.
- 1 worker replica for outbox/cleanup (or run in-process with a singleton lock for small deployments).
- Centralized log sink, metrics store, and alerting.
- Secret manager and a deploy pipeline with approvals.

**Scaling guidance**

- Scale API replicas horizontally; keep them stateless.
- Scale PostgreSQL vertically first; add read replicas only for measured read pressure.
- Use PgBouncer if connection count/churn is the bottleneck.
- Scale workers independently based on queue lag.
- Do not scale Redis blindly; monitor memory, evictions, and latency.

### 10.10 Architecture Decision Records to Write

Create short ADRs under `docs/adr/` for:

1. Modular monolith and module boundaries.
2. Session-bound JWT plus refresh-token model.
3. Authorization model: route guards + policy layer + versioning.
4. Outbox/jobs instead of a message broker.
5. Cache crypto and invalidation strategy.
6. Error taxonomy and API envelope.
7. Observability stack and retention.
8. Data retention, soft delete, and audit requirements.
9. Deployment topology and migration strategy.
10. Secret management and key rotation.

Each ADR should state context, decision, alternatives, consequences, and review date.

---

## 11. Implementation Roadmap

### 11.1 Planning Assumptions

- One senior full-stack engineer familiar with TypeScript, Express, PostgreSQL, and security.
- Part-time security review and part-time DevOps support.
- No product-specific feature work is included.
- Estimates are person-weeks (pw) and exclude holidays, procurement, and organizational delays.
- The sequence assumes the P0 defects are fixed before any new product capability is shipped.

**Total estimate:** 12–16 person-weeks for a production candidate (P0 + P1), or 6–8 calendar weeks with two engineers working in parallel on separate tracks. P2 adds roughly 5–8 person-weeks. P3 is product-dependent and not estimated.

### 11.2 Phase Overview

| Phase | Focus | Duration | Effort | Exit criteria |
| --- | --- | --- | --- | --- |
| 0 | Baseline, guardrails, regression harness | 1 week | 0.5–1 pw | Test baseline recorded; lint scoped; regression tests for P0 exist (failing) |
| 1 | P0 correctness | 2 weeks | 1.5–2.5 pw | Validation, admin CRUD, token issuance, deletion semantics fixed and tested |
| 2 | P0 security | 2–3 weeks | 2–2.5 pw | Session/status enforcement, rate limits, TFA, recovery, config, CORS fixed |
| 3 | P1 identity and authorization | 3 weeks | 2–3 pw | Refresh tokens, verification, fresh authorization, route guards |
| 4 | P1 data and platform | 3 weeks | 2–3 pw | Error mapping/transactions, cache, observability, health, audit, jobs |
| 5 | P1 productionization | 2–3 weeks | 2–4 pw | CI gates, container, DB hardening, full regression/security/load smoke |
| 6 | P2 maturity | 4–6 weeks | 5–8 pw | OpenAPI, load program, object/field auth, idempotency, search |
| 7 | P3 optional | Product-dependent | TBD | Only with a funded requirement |

Phases overlap in practice. For example, CI/container work (Phase 5) can start early, and regression tests (Phase 0) continue through every phase. Phase effort sums to **10–16 pw** for P0+P1 (P0 4–6 pw, P1 6–10 pw). The **12–16 pw** planning range in Section 11.1 adds integration, review, and contingency on top of the phase sums; use the phase sums for staffing and the planning range for commitments.

### 11.3 Phase 0 — Baseline and Guardrails (Week 1)

**Goals:** establish a trustworthy baseline and prevent regressions while fixing P0 defects.

**Deliverables**

1. Run the full test suite, record pass/fail/skip counts, duration, and flakiness. Do not change behavior yet.
2. Run `npm run lint`, scope ESLint to ignore `.agents/`, `dist/`, `build/`, and coverage; record remaining application warnings.
3. Add coverage measurement (no threshold yet) and publish a baseline report.
4. Add regression tests for F-01–F-10 that fail on the current code. Keep them in a dedicated `tests/regression/` or colocated suite.
5. Add a minimal test-data factory and per-test cleanup to make new tests deterministic.
6. Document the current API behavior and known defects in the issue tracker.
7. Freeze new feature work until Phase 1 is complete.

**Exit criteria**

- Baseline artifacts are stored.
- Regression tests demonstrate each P0 defect.
- Lint/typecheck/build commands are meaningful and documented.
- The team agrees on the definition of done (Section 9.12).

### 11.4 Phase 1 — P0 Correctness (Weeks 2–3)

**Features:** F-01, F-02, F-03, F-05.

**Deliverables**

1. Scalar uniqueness validator and correct role existence checks.
2. User create/update validation and correct `ignoreId`.
3. Unified token issuance; `tid: 0` removed; account tokens usable and revocable.
4. Role FK changed to `RESTRICT`; user soft delete; destructive actions audited or blocked.
5. Regression tests green.
6. Migration for FK change and any backfill; tested on a production-like snapshot.

**Exit criteria**

- Admin user create/update works end-to-end.
- Duplicate registration returns 409, not 500.
- Profile/password changes return tokens that work on authorized endpoints.
- Deleting a role with users returns 409 and deletes nothing.
- No `tid: 0` path remains.

### 11.5 Phase 2 — P0 Security (Weeks 3–5)

**Features:** F-04, F-06, F-07, F-08, F-09, F-10.

**Deliverables**

1. Session expiry, status checks, and revocation on password/status/role changes.
2. Layered rate limits for login, registration, recovery, and TFA.
3. Coherent TFA policy, enrollment, `has_tfa`, lockout repair, POST endpoints.
4. Atomic, non-enumerating password recovery with session revocation; phone channel implemented or disabled.
5. Validated environment configuration and required secrets.
6. CORS allowlist, security headers, body limits, proxy trust, and POST for state-changing actions.
7. Security regression tests for each item.

**Exit criteria**

- Expired/revoked/suspended access fails immediately.
- Auth endpoints return 429 under abuse and do not leak account existence.
- TFA cannot be bypassed and does not permanently lock users out.
- Password reset invalidates old sessions and leaves no partial state.
- The app refuses to boot with missing/insecure production configuration.
- CORS rejects unlisted origins.

### 11.6 Phase 3 — P1 Identity and Authorization (Weeks 5–8)

**Features:** F-11, F-12, F-13, F-14.

**Deliverables**

1. Short-lived access tokens and rotating refresh tokens with reuse detection.
2. Email/phone verification with resend limits and flag resets on change.
3. Authorization versioning/fresh role checks; route-guard unique constraint, index, seed, and matrix tests.
4. Fixed admin browse filters and cached `/settings/values`.
5. Documentation for the new auth/session model.

**Exit criteria**

- Refresh rotation/reuse detection works; logout-all revokes all families.
- Unverified contact changes cannot be used for recovery.
- Role changes take effect within the defined SLA.
- Seeded roles have correct permissions; duplicate guards are rejected.
- Admin list endpoints work with no query parameters.

### 11.7 Phase 4 — P1 Data and Platform (Weeks 7–10)

**Features:** F-15, F-16, F-17, F-18, F-19, F-20.

**Deliverables**

1. Database error mapping and transaction boundaries for registration, reset, status/role changes, and deletion.
2. Redis cache crypto redesign, TTL, reconnect, and stampede protection.
3. Request IDs, structured logs, redaction, error serialization, and baseline HTTP/DB/cache/auth metrics.
4. Health/readiness endpoints and graceful shutdown.
5. Append-only audit log for security/admin events.
6. Outbox/worker for email and cleanup.

**Exit criteria**

- Duplicate/FK errors return stable 4xx codes; no partial writes in failure tests.
- Cache reads are fast and invalidate across instances; Redis restart recovers subscriptions.
- Logs are JSON in production, correlated by request ID, and redact secrets.
- Baseline metrics cover HTTP latency/errors, DB pool, cache, and auth outcomes.
- Probes and shutdown behave correctly under orchestration.
- Audit events cover the defined taxonomy.
- Email is sent by the worker, not inside a transaction.

### 11.8 Phase 5 — P1 Productionization (Weeks 9–11)

**Features:** F-21, F-22, F-23, F-25 (completion).

**Deliverables**

1. Pool sizing, timeouts, indexes, migration runbook, and PgBouncer evaluation.
2. CI gates: lint, typecheck, build, tests, coverage, audit, CodeQL, dependency review, image scan, SBOM.
3. Multi-stage non-root production image, `.dockerignore`, healthcheck, compose profile.
4. Full regression/security/E2E suite green in CI.
5. Deployment, rollback, backup/restore, and incident-response runbooks.

**Exit criteria**

- A release candidate passes all gates and deploys to staging.
- Migration and rollback rehearsals succeed.
- Existing load smoke runs without errors; formal thresholds are defined in Phase 6.
- No critical/high unresolved security findings.
- On-call and escalation paths are defined.

### 11.9 Phase 6 — P2 Maturity (Weeks 12–16)

**Features:** F-24, F-26, F-27, F-28, F-29.

**Deliverables**

1. OpenAPI contract, docs site, and contract tests.
2. Load/performance program with baselines and thresholds.
3. Object/field-level authorization policy and matrix tests.
4. Idempotency keys for selected POSTs.
5. Trigram search indexes and pagination consistency.

**Exit criteria**

- API docs match the implementation and are validated in CI.
- Performance baselines are recorded and regression-gated.
- Authorization matrix covers ownership and privileged fields.
- Retried writes do not duplicate resources.
- Search meets latency targets on representative data.

### 11.10 Phase 7 — P3 Optional

Only start with a funded requirement and a written ADR. Candidates: TOTP/WebAuthn, enterprise SSO, advanced reporting, multi-tenancy, read replicas, a message broker. Do not bundle these into the production-readiness critical path.

### 11.11 Staffing and Parallel Tracks

| Track | Owner | Work |
| --- | --- | --- |
| Security/auth | Backend engineer 1 | F-01–F-13, F-19, F-27 |
| Platform/data | Backend engineer 2 | F-15–F-18, F-20–F-23, F-26, F-28, F-29 |
| Quality | QA/engineer shared | F-25, regression, E2E, load, contract tests |
| Product/docs | Product/tech writer | F-24, runbooks, ADRs, API examples |
| Review | Security/DevOps | Threat model, config review, pen test, deploy rehearsal |

With one engineer, run the phases sequentially. With two, run the security/auth and platform/data tracks in parallel after Phase 1, with a weekly integration checkpoint.

### 11.12 Roadmap Risks

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| P0 fixes reveal deeper schema issues | Medium | High | Time-box investigation; add migrations early; test on a snapshot |
| TFA policy decision stalls | Medium | Medium | Decide global vs. per-user in Phase 1; document in an ADR |
| Refresh-token rollout breaks clients | Medium | High | Version the auth API; support a migration window; feature flag |
| CI/container work blocked by platform access | Medium | Medium | Start early; use a staging registry; document manual fallback |
| Security review finds new critical issues | Medium | High | Reserve 20% buffer; triage by exploitability; do not ship with criticals |
| Test suite remains flaky | High | Medium | Invest in isolation/factories in Phase 0; quarantine and fix |
| Scope creep from product features | High | High | Enforce the P0/P1 gate; require an ADR and trade-off for new scope |

---

## 12. Dependencies and Implementation Order

### 12.1 Dependency Graph

```text
Independent roots
  F-01  Validation correctness
  F-09  Configuration validation
  F-22  CI quality gates

F-01 --> F-02 --> F-03 --> F-04
                          |  |
                          |  +--> F-07 (also needs F-06)
                          |  +--> F-08 (also needs F-06)
                          |  +--> F-11
                          |  +--> F-13
                          |  +--> F-19 (also needs F-17)
                          +-----> F-15 (also needs F-01)

F-05 (independent; revocation is stronger after F-04)
F-14 (independent; cache hardening is F-16)

F-09 --> F-06 --> F-07/F-08/F-12
F-09 --> F-10
F-09 --> F-16
F-09 --> F-17 --> F-18
F-17 --> F-19

F-15 --> F-20 (also needs F-08)
F-15 --> F-21
F-15 --> F-28 (also needs F-20)

F-21 --> F-26 (also needs F-25)
F-21 --> F-29 (also needs F-24)

F-22 --> F-23

F-01..F-10 --> F-25
F-13 --> F-27
F-14 --> F-24 --> F-29
F-07/F-11 --> F-30
```

### 12.2 Topological Waves

| Wave | Features that can start | Notes |
| --- | --- | --- |
| 0 | F-01, F-05, F-09, F-22 | No hard dependencies; start immediately |
| 1 | F-02, F-06, F-10, F-14, F-16, F-17, F-23 | F-02 needs F-01; F-06/F-10/F-16/F-17 need F-09; F-23 needs F-22; F-14 is independent |
| 2 | F-03, F-18 | F-03 needs F-02; F-18 needs F-17 |
| 3 | F-04 | Needs F-03 |
| 4 | F-07, F-08, F-11, F-13, F-15, F-19 | All need F-04 and/or F-01/F-17 |
| 5 | F-12, F-20, F-21, F-25, F-27 | F-12 needs F-06/F-08; F-20/F-21 need F-15; F-25 needs P0; F-27 needs F-13 |
| 6 | F-24, F-26, F-28 | F-24 needs F-14; F-26 needs F-21/F-25; F-28 needs F-15/F-20 |
| 7 | F-29, F-30 | F-29 needs F-21/F-24; F-30 needs F-07/F-11 |

This is a dependency order, not a mandate to build one feature at a time. Use the parallel tracks in Section 11.11.

### 12.3 Critical Path

The longest P0/P1 chain is:

```text
F-01 → F-02 → F-03 → F-04 → F-08 → F-20
```

Approximate effort on this path: 0.5 + 0.5 + 2 + 2 + 2 + 4 = 11 person-days of feature engineering, plus review, testing, and migrations. The P2 extension `F-20 → F-28` adds roughly 2 days. This is why the realistic production candidate estimate is 12–16 person-weeks rather than a few days.

**Near-critical paths**

- F-09 → F-06 → F-07 (rate limits and TFA) — security-critical and hard to parallelize with F-04 because TFA needs live sessions.
- F-01 → F-15 → F-21 → F-26 (data/performance) — can run in parallel with auth work after F-01.
- F-17 → F-19 (observability → audit) — needed for incident response but not for functional correctness.

### 12.4 Recommended Release Sequence

| Release | Contents | Why this order |
| --- | --- | --- |
| R1 — Correctness | F-01, F-02, F-03, F-05 | Unblocks admin workflows and removes the most dangerous token/deletion defects |
| R2 — Security baseline | F-04, F-06, F-07, F-08, F-09, F-10 | Closes authentication abuse and configuration holes |
| R3 — Identity | F-11, F-12, F-13, F-14 | Adds refresh tokens, verification, fresh authorization, admin fixes |
| R4 — Platform | F-15, F-16, F-17, F-18, F-19, F-20 | Makes failures observable and async work durable |
| R5 — Productionization | F-21, F-22, F-23, F-25 | Enables a safe, repeatable deployment |
| R6 — Maturity | F-24, F-26, F-27, F-28, F-29 | Improves contract, performance, and scale |
| R7 — Optional | F-30 | Product-dependent |

### 12.5 Migration and Deployment Ordering Rules

1. **Expand, backfill, contract.** Add nullable columns/tables, backfill in batches, deploy code that writes both paths, then enforce `NOT NULL`/constraints, then remove the old path. Never combine a destructive schema change with the first deploy that uses it.
2. **Configuration before code.** Deploy validated config and secrets before enabling features that require them (rate limits, refresh tokens, Redis TLS).
3. **Migrations run once.** Use a dedicated migration job/step; do not let every replica race. Take a backup/snapshot before destructive changes.
4. **Feature flags for behavior changes.** Refresh tokens, TFA policy, and soft delete should be switchable during rollout. Flags must be removed after stabilization.
5. **Backward-compatible API changes.** Add fields/endpoints before removing old ones. Keep deprecated paths for a documented window.
6. **Rollback plan per release.** Code rollback must not require reversing a data migration. Prefer additive migrations; document compensating actions for destructive ones.
7. **Verify after deploy.** Run smoke tests, health checks, and a read/write probe. Watch error rate, latency, and auth failures for at least one traffic cycle.

### 12.6 Cross-Feature Constraints

| Constraint | Implication |
| --- | --- |
| Every token must reference a session | F-03 must land before F-11/F-13; no new token path may reintroduce `tid: 0` |
| Status/role changes must revoke or version | F-04 and F-13 must share the same invalidation mechanism |
| Email must leave the transaction | F-08 depends on F-20 for full correctness; until then, send after commit |
| Rate limits need trusted client IP | F-06 depends on correct proxy trust (F-10) |
| Audit needs request context | F-19 depends on F-17 |
| Cache invalidation needs stable keys | F-14 can use the existing cache; F-16 defines the hardened key/version scheme |
| CI gates need lint scope fixed | F-22 must ignore vendored `.agents` files before failing on lint |
| Production image needs a health endpoint | F-23 depends on F-18 for healthcheck |
| Idempotency needs transactions/outbox | F-28 depends on F-15/F-20 |

### 12.7 Risk-Ordered Backlog (If Capacity Is Limited)

If only a fraction of the roadmap can be funded, do these in order:

1. F-01, F-02 (validation and admin CRUD) — highest functional impact, lowest effort.
2. F-03, F-04 (token/session/status) — highest security impact.
3. F-05 (deletion semantics) — prevents data loss.
4. F-06, F-09, F-10 (rate limits, secrets, CORS) — prevents practical attacks.
5. F-07, F-08 (TFA, recovery) — closes account takeover paths.
6. F-15, F-17, F-18 (errors/transactions, logs, health) — makes production debuggable.
7. F-22, F-23 (CI, container) — makes deploys safe.
8. Everything else.

Do not deploy to production with items 1–5 incomplete, even if all P1/P2 work is deferred.

---

## 13. Production Readiness Checklist

### 13.1 How to Use This Checklist

Status values:

- **Done** — verified in the repository or by an executed check.
- **Partial** — present but incomplete or defective.
- **Missing** — not implemented.
- **Not verified** — cannot be confirmed without running a test/scan in the target environment.

This checklist is intentionally conservative. A checked box requires evidence, not intention. The only executed verifications for this report were `tsc --noEmit` (passed), `npm run lint` (failed on vendored files), `npm run db:migrate` (passed), DB connectivity (passed), and the two read-only validation probes described in Section 4.1.

### 13.2 Security

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| S1 | Every access token references a live session | Done | Every token references a live session; F-03 |
| S2 | Session expiry enforced on every request | Done | `findById` filters on `expired_at`; F-04 |
| S3 | Suspended/deactivated users cannot authenticate or use tokens | Done | Status checked at login and on every request; F-04 |
| S4 | Password/status/role changes revoke sessions atomically | Done | Update and revocation share a transaction; F-04/F-15 |
| S5 | Login/registration/recovery/OTP rate-limited | Done | Rate limiter on every sensitive endpoint; F-06 |
| S6 | TFA policy explicit, enforced, and tested | Done | `tta_policy`, enrollment and lockout repair; F-07 |
| S7 | Password reset atomic, non-enumerating, session-revoking | Done | Constant response, atomic reset, sessions revoked; F-08 |
| S8 | Role deletion cannot delete users | Done | RESTRICT foreign keys and a 409 on delete; F-05 |
| S9 | User deletion is soft by default; hard delete restricted/audited | Done | Soft delete by default; permanent removal is privileged and audited; F-05 |
| S10 | CORS uses an explicit allowlist; no wildcard with credentials | Done | Explicit allowlist; the wildcard never reflects an origin; F-10 |
| S11 | Required secrets validated at boot; no empty secrets | Done | Joi schema with production rules; F-09 |
| S12 | JWT short-lived; refresh rotation/reuse detection | Done | 15-minute access token, rotating refresh token with reuse detection; F-11 |
| S13 | JWT has `iss`/`aud`/`jti`; algorithm pinned | Done | `iss`, `aud`, `jti` and a pinned `HS256`; F-03/F-11 |
| S14 | Authorization uses fresh role/permission state | Done | `authorization_version` is compared on every request; F-13 |
| S15 | Route guards have unique constraint, index, and seed | Done | Unique `(role_id, route)`, an index and a seeded catalog; F-13 |
| S16 | Email/phone verification implemented; flags reset on change | Done | Verification tokens, endpoints and flag resets; F-12 |
| S17 | No critical/high SAST findings | Not verified | Run CodeQL/Semgrep |
| S18 | No critical/high dependency findings | Not verified | Run `npm audit`/SCA |
| S19 | No critical/high container findings | Not verified | Build and scan image |
| S20 | Secrets not in repo/history; scanning enabled | Not verified | Run secret scan |
| S21 | TLS enforced for DB/Redis in production | Done | Production configuration requires TLS for remote endpoints; F-09 |
| S22 | Least-privilege DB roles (runtime vs. migration) | Missing | Platform task; the runtime role is not separated yet |
| S23 | Security headers/HSTS/CSP configured for deployment | Done | Helmet with a restrictive CSP; F-10 |
| S24 | Body limits and proxy trust configured | Done | Explicit body limits and `trust proxy` toggle; F-10 |
| S25 | State-changing operations use POST | Done | GET aliases removed; only POST is supported; F-10 |
| S26 | Audit log covers auth/admin events | Done | `audit_logs` with a read API; F-19 |
| S27 | Logs redact secrets/PII | Done | Pino redaction of secrets, tokens and codes; F-17 |
| S28 | Penetration test completed | Not verified | Schedule before launch |
| S29 | Threat model reviewed for this release | Done | This document and the ADRs; F-24 |
| S30 | Incident-response and security contact documented | Partial | Runbooks written; the security contact is an organisational task |
| S31 | FK CASCADE on auth/session tables fixed | Done | All four foreign keys use RESTRICT; F-05 |
| S32 | JWT algorithm pinned to HS256 (or RS256/EdDSA) | Done | `algorithms: ['HS256']`; F-11 |
| S33 | Rate limit on /auth/logout endpoint | Done | The logout endpoint is rate limited; F-06 |
| S34 | SendGrid TLS certificate verification enforced | Done | TLS verification is explicit on the mail agent; F-08 |
| S35 | Cluster primary signal handling (SIGTERM/SIGINT) | Done | The cluster primary forwards the signals; F-18 |

### 13.3 Authentication and Authorization

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| A1 | Registration validates duplicates and returns 409 | Done | Duplicate registration returns 409; F-01 |
| A2 | Admin user create/update works | Done | Admin create and update work end to end; F-01/F-02 |
| A3 | Password policy follows modern guidance | Done | 12 to 64 characters, no composition rules; S-25 |
| A4 | Breached-password screening | Missing | Breached-password screening is not implemented (P2, optional) |
| A5 | Login lockout resets on success | Done | The counters reset on a successful login; F-04 |
| A6 | TFA enrollment sets `has_tfa`; policy enforced | Done | `has_tfa` is set on enrollment and the policy is enforced; F-07 |
| A7 | OTP lockout expires; new OTP resets tries | Done | The lockout expires and a new OTP resets the counter; F-07 |
| A8 | Recovery codes/TFA fallback documented | Done | Recovery codes are generated on enrollment; F-07 |
| A9 | Logout-all and session listing | Done | `POST /auth/logout-all` and `GET /auth/sessions`; F-11 |
| A10 | Refresh token reuse detection | Done | Reuse revokes the whole family; F-11 |
| A11 | Authorization matrix tests per role | Done | The seeded roles and the guard matrix are covered; F-13/F-25 |
| A12 | Object-level authorization | Partial | Ownership is enforced for the user's own record; F-27 |
| A13 | Field-level authorization for privileged fields | Done | Only an administrator may change the privileged fields; F-27 |
| A14 | Admin bypass grants audited and restricted | Done | The bypass flag requires an administrator and is audited; F-13/F-19 |
| A15 | Account status changes revoke access | Done | A status change revokes the sessions; F-04 |
| A16 | Password change revokes other sessions | Done | A password change revokes the other sessions; F-03 |

### 13.4 Data and Database

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| D1 | Migrations run successfully | Done | `npm run db:migrate` exit 0 |
| D2 | Migration rollback/compensating plan | Done | Every migration has a `down`; the runbook documents the rollback |
| D3 | Seeds idempotent and safe to re-run | Done | The seeders upsert; F-25 |
| D4 | No weak/default production credentials | Done | The seed password comes from the environment or is generated; F-09 |
| D5 | Unique/FK/check constraints enforced | Done | Route guards are unique; F-13 |
| D6 | Transactions for multi-step writes | Done | Registration, reset and the privilege changes are transactional; F-15 |
| D7 | DB errors mapped to stable 4xx/5xx | Done | PostgreSQL error codes map to stable responses; F-15 |
| D8 | Soft delete + retention policy | Done | Soft delete with a retention policy; F-05 |
| D9 | Backup and PITR configured | Not verified | Platform task |
| D10 | Restore drill passed | Not verified | Schedule |
| D11 | Indexes reviewed with query plans | Not verified | F-21 |
| D12 | Slow query logging/`pg_stat_statements` | Done | The pool sets the statement and lock timeouts; F-21 |
| D13 | Statement/lock timeouts configured | Done | `statement_timeout`, `lock_timeout` and `idle_in_transaction_session_timeout`; F-21 |
| D14 | Pool sizing documented and validated | Done | The boot check compares the budget with the worker count; F-21 |
| D15 | PgBouncer evaluated | Missing | F-21 |
| D16 | Autovacuum/bloat monitoring | Missing | Platform task |
| D17 | Data retention/erasure policy | Missing | Legal/product |
| D18 | PII inventory and classification | Missing | Privacy task |
| D19 | Encryption at rest for sensitive fields | Partial | Redis payloads only; DB depends on platform |
| D20 | Least-privilege runtime DB role | Missing | F-21 |
| D21 | FK CASCADE removed from auth/session tables | Done | All four foreign keys use RESTRICT; F-05 |
| D22 | `expired_at` NOT NULL on authentication_tokens | Done | `expired_at` is NOT NULL; F-04 |

### 13.5 API and Application

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| P1 | Consistent error envelope and codes | Done | One envelope and a stable code; F-15 |
| P2 | Validation covers all inputs | Done | Every input is validated; F-01/F-14 |
| P3 | Unknown fields stripped | Done | Joi `stripUnknown` |
| P4 | Pagination consistent and documented | Done | `page`/`per_page` and the cursor; F-29 |
| P5 | OpenAPI contract published and tested | Done | `docs/openapi.yaml` with a CI drift check; F-24 |
| P6 | Idempotency for retryable POSTs | Done | `Idempotency-Key` on the unsafe endpoints; F-28 |
| P7 | Request size limits explicit | Done | Explicit 100 kB limits; F-10 |
| P8 | API versioning/deprecation policy | Partial | `/v1` only |
| P9 | Health/readiness endpoints | Done | `/health/live` and `/health/ready`; F-18 |
| P10 | Graceful shutdown | Done | The workers drain and the primary forwards the signals; F-18 |
| P11 | State-changing GETs removed | Done | GET aliases removed; only POST is supported; F-10 |
| P12 | CORS behavior documented | Done | The allowlist and the error envelope are documented; F-24 |
| P13 | Rate-limit headers documented | Done | The rate-limit headers are documented; F-24/F-06 |
| P14 | No stack traces/schema leakage in errors | Done | Structured, redacted logs; the response carries no internals; F-17 |
| P15 | Request IDs exposed/returned | Done | `X-Request-ID` is returned and correlated; F-17 |

### 13.6 Performance and Scalability

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| PF1 | Baseline latency/throughput measured | Not verified | F-26 |
| PF2 | Load thresholds defined and enforced | Partial | Configs exist; not run |
| PF3 | p95/p99 within budget at expected peak | Not verified | F-26 |
| PF4 | No pool exhaustion under peak | Not verified | F-21/F-26 |
| PF5 | Cache faster than DB and effective | Done | AES-256-GCM without bcrypt; F-16 |
| PF6 | Cache invalidation across instances | Done | Pub/sub invalidation with re-subscription on reconnect; F-16 |
| PF7 | Search indexed for leading wildcards | Done | `pg_trgm` GIN indexes; F-29 |
| PF8 | No N+1 queries | Done | Reviewed repositories |
| PF9 | Connection budget documented | Missing | F-21 |
| PF10 | Soak test shows no leaks | Not verified | F-26 |
| PF11 | Redis outage degrades gracefully | Done | The database fallback and the re-subscription; F-16 |
| PF12 | Email/HTTP calls outside transactions | Done | Email is queued in the outbox; F-20 |
| PF13 | Session lookup uses `expired_at` index | Done | The expiry predicate uses the index; F-04 |
| PF14 | User browse `per_page` parameter documented correctly | Done | The contract documents `per_page`; F-24 |

### 13.7 Observability and Operations

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| O1 | Structured JSON logs in production | Done | JSON in production; F-17 |
| O2 | Request IDs and correlation | Done | The request context and the `X-Request-ID`; F-17 |
| O3 | Log redaction | Done | Pino redaction; F-17 |
| O4 | Metrics (HTTP, DB, Redis, auth) | Done | HTTP, auth, rate-limit, cache, pool, outbox and audit metrics; F-17 |
| O5 | Traces | Missing | Optional/OTel |
| O6 | Dashboards | Missing | Platform task |
| O7 | Alerts (error rate, latency, pool, auth) | Missing | Platform task |
| O8 | Audit log | Done | The append-only audit trail; F-19 |
| O9 | Health/readiness probes | Done | The health and readiness probes; F-18 |
| O10 | Graceful shutdown/drain | Done | The graceful shutdown with a drain timeout; F-18 |
| O11 | Backup/PITR monitoring | Not verified | Platform task |
| O12 | Runbooks (deploy, rollback, DB, incident) | Done | The runbooks in `docs/runbooks/` |
| O13 | On-call/escalation | Missing | Org task |
| O14 | Capacity plan | Missing | F-21/F-26 |
| O15 | Cost/usage monitoring | Missing | Platform task |

### 13.8 Testing and Quality

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| T1 | Unit tests exist | Done | 34 files |
| T2 | Integration tests exist | Done | 5 files |
| T3 | Test suite passes | Done | 682 tests pass; `npm run test:run` |
| T4 | Regression tests for P0 defects | Done | `tests/integration/regression.spec.ts`; F-25 |
| T5 | Tests isolated and parallel-safe | Missing | Shared DB; no-file-parallelism |
| T6 | Deterministic fixtures/factories | Missing | F-25 |
| T7 | Coverage measured and gated | Done | Coverage thresholds gate the build; F-25 |
| T8 | E2E critical journeys | Done | The session and account journeys are covered; F-25 |
| T9 | Authorization matrix tests | Done | The seeded roles are covered; F-13/F-25 |
| T10 | Security regression tests | Done | The regression suite is the security suite; F-25 |
| T11 | Contract tests | Done | The OpenAPI contract is validated against the routes; F-24 |
| T12 | Load smoke in CI | Missing | F-26 |
| T13 | Flaky tests tracked/fixed | Missing | F-25 |
| T14 | Migration/seed tests | Done | The migration and seed checks run in CI; F-22 |
| T15 | Test data privacy | Partial | Synthetic/mocks; no policy |

### 13.9 CI/CD and Supply Chain

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| C1 | CI runs tests | Done | Workflow exists |
| C2 | CI runs lint | Done | The lint job runs; F-22 |
| C3 | CI runs typecheck | Done | The typecheck job runs; F-22 |
| C4 | CI runs build | Done | The build job runs; F-22 |
| C5 | CI enforces coverage | Done | The coverage job runs; F-22 |
| C6 | CI runs dependency audit | Done | `npm run audit:prod` runs; F-22 |
| C7 | CI runs SAST | Done | The image scan runs with Trivy; F-22 |
| C8 | Dependency review on PRs | Missing | F-22 |
| C9 | Actions pinned to SHAs | Missing | F-22 |
| C10 | Image built/scanned/signed | Done | The image is built and scanned; F-22/F-23 |
| C11 | SBOM generated | Done | An SBOM is generated; F-22 |
| C12 | Secret scanning enabled | Missing | Platform task |
| C13 | Branch protection required checks | Missing | Org task |
| C14 | Deploy approvals/environments | Missing | Org task |
| C15 | Rollback tested | Not verified | F-23/runbook |

### 13.10 Infrastructure and Container

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| I1 | Production image is multi-stage | Done | The image is multi-stage; F-23 |
| I2 | Runs as non-root | Done | The runtime user is `node`; F-23 |
| I3 | Minimal runtime (no dev tools/SSH) | Done | No development tooling in the runtime stage; F-23 |
| I4 | `.dockerignore` present | Done | `.dockerignore` is present; F-23 |
| I5 | `CMD`/entrypoint defined | Done | `CMD ["node", "dist/src/index.js"]`; F-23 |
| I6 | Healthcheck defined | Done | The healthcheck hits `/health/live`; F-18/F-23 |
| I7 | Base image pinned by digest | Missing | F-23 |
| I8 | Compose uses `env_file`/secrets | Done | The compose file reads `.env`; F-23 |
| I9 | Compose has PostgreSQL/Redis for local dev | Done | The compose file provides PostgreSQL and Redis; F-23 |
| I10 | TLS termination configured | Not verified | Platform task |
| I11 | Network policies/firewalls | Not verified | Platform task |
| I12 | Redis/PostgreSQL not publicly exposed | Not verified | Platform task |
| I13 | Resource limits/requests | Missing | Platform task |
| I14 | Horizontal scaling tested | Not verified | F-26 |
| I15 | Disaster recovery documented | Missing | Runbook |

### 13.11 Documentation and Compliance

| # | Item | Status | Evidence / action |
| --- | --- | --- | --- |
| DC1 | README endpoints correct | Done | The README uses `/api/v1/auth/login`; F-24 |
| DC2 | Pagination docs correct | Done | The README uses `per_page`; F-24 |
| DC3 | Auth/session model documented | Done | ADR-002 and the runbooks; F-24 |
| DC4 | OpenAPI published | Done | `docs/openapi.yaml`; F-24 |
| DC5 | Runbooks written | Done | The runbooks in `docs/runbooks/` |
| DC6 | ADRs recorded | Done | Ten ADRs in `docs/adr/`; F-24 |
| DC7 | Data retention/privacy policy | Missing | Legal/product |
| DC8 | Terms/consent where required | Missing | Legal/product |
| DC9 | License/dependency obligations reviewed | Not verified | Legal |
| DC10 | Security contact/disclosure policy | Missing | Org task |
| DC11 | Changelog/release notes | Missing | Process |
| DC12 | Architecture diagram current | Partial | This document |

### 13.12 Launch Gate

A production launch requires all of the following:

- [ ] All P0 features (F-01–F-10) are complete and verified.
- [ ] No open critical/high security findings without an approved, time-bound exception.
- [ ] Test suite is green in CI with coverage gates.
- [ ] Regression, authorization, and security tests cover the launch scope.
- [ ] Load smoke meets the defined budgets; baseline is recorded.
- [ ] Migrations and rollback have been rehearsed on a production-like snapshot.
- [ ] Backup/restore drill passed.
- [ ] Health/readiness and graceful shutdown verified in the target orchestrator.
- [ ] Logs, metrics, alerts, and audit are live and tested.
- [ ] Runbooks and on-call rotation are in place.
- [ ] Secrets are in a secret manager and validated at boot.
- [ ] CORS, TLS, proxy trust, and rate limits are configured for the real topology.
- [ ] A named launch owner and a rollback decision maker are assigned.
- [ ] A post-launch review is scheduled within one week.

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

Sources are grouped by the claim they support. Standards and vendor documentation are cited for recommendations; repository files are cited for findings about this codebase. Where a recommendation is a judgment call (for example, token lifetimes or coverage thresholds), the document says so and gives a starting point rather than presenting it as a universal rule.

Version-sensitive sources were checked during this review. Standards evolve; re-check before implementing or auditing.

### 14.2 Security Standards and Guidance

| Source | Use in this document |
| --- | --- |
| [OWASP Top 10:2025](https://owasp.org/Top10/) | Risk categories for access control, misconfiguration, supply chain, crypto, injection, design, authentication, integrity, logging, and exceptional conditions |
| [OWASP API Security Top 10:2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/) | API-specific risks: BOLA, broken authentication, object-property authorization, resource consumption, function-level authorization, sensitive flows, SSRF, misconfiguration, inventory, unsafe API consumption |
| [OWASP Application Security Verification Standard (ASVS) 5.0](https://owasp.org/www-project-application-security-verification-standard/) | Verification categories for authentication, session management, access control, validation, crypto, logging, and configuration |
| [OWASP ASVS repository](https://github.com/OWASP/ASVS) | Requirement text and version history |
| [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) | bcrypt/Argon2id guidance, work factors, pepper considerations, 72-byte bcrypt limit |
| [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) | Credential handling, lockout, generic errors, MFA |
| [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html) | Deny-by-default, object/field authorization, policy enforcement |
| [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) | Session IDs, expiry, rotation, revocation, cookie attributes |
| [OWASP HTML5 Security Cheat Sheet — CORS](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html) and [REST Security Cheat Sheet — CORS](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) | Allowlists, credentials, preflight, wildcard risks |
| [OWASP Cross-Site Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html) | CSRF defenses if cookies are introduced |
| [OWASP Cross Site Scripting Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html) | Output encoding, CSP, why server-side filtering is not sufficient |
| [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) | Allowlisting, canonicalization, validation vs. sanitization |
| [OWASP SQL Injection Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html) | Parameterization and identifier handling |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | What to log, what not to log, retention, integrity |
| [OWASP Error Handling Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html) | Safe error responses and logging |
| [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | Storage, rotation, access control |
| [OWASP Web Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/) | Security test cases and methodology |
| [OWASP SAMM](https://owaspsamm.org/) | Security program maturity model |
| [NIST SP 800-63B-4: Digital Identity Guidelines — Authentication and Lifecycle Management](https://pages.nist.gov/800-63-4/sp800-63b.html) | Password length/allowable characters, breached-password screening, authenticator lifecycle, MFA |
| [NIST SP 800-63B-4 DOI](https://doi.org/10.6028/NIST.SP.800-63B-4) | Stable citation |
| [RFC 7519: JSON Web Token (JWT)](https://www.rfc-editor.org/rfc/rfc7519.html) | JWT claims and structure |
| [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html) | Algorithm pinning, `iss`/`aud`, token validation, key management |
| [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html) | Refresh-token rotation, replay detection, sender constraint, redirect validation |
| [RFC 6749: The OAuth 2.0 Authorization Framework](https://www.rfc-editor.org/rfc/rfc6749.html) | Token/refresh concepts referenced by the refresh design |
| [RFC 6238: TOTP](https://www.rfc-editor.org/rfc/rfc6238.html) | TOTP algorithm for F-30 |
| [W3C Web Authentication (WebAuthn) Level 3](https://www.w3.org/TR/webauthn-3/) | Passkey/WebAuthn design for F-30 |
| [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html) | SSO/OIDC design for F-30 |
| [CWE Top 25](https://cwe.mitre.org/top25/) | Weakness taxonomy for security reviews |
| [FIRST CVSS](https://www.first.org/cvss/) | Severity scoring vocabulary |

### 14.3 Framework and Library Documentation

| Source | Use in this document |
| --- | --- |
| [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) | Helmet, TLS, secrets, dependency hygiene |
| [Express Performance Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html) | Compression, reverse proxy, process management |
| [Node.js Security Best Practices](https://nodejs.org/en/learn/getting-started/security-best-practices) | Runtime hardening, dependency and secret handling |
| [Node.js `cluster`](https://nodejs.org/api/cluster.html) | Worker lifecycle and primary/worker signals |
| [Node.js `AsyncLocalStorage`](https://nodejs.org/api/async_context.html) | Request-scoped context for logging/audit |
| [Kysely documentation](https://kysely.dev/) | Typed SQL, migrations, transactions |
| [Kysely transactions](https://kysely.dev/docs/category/transactions) | Unit-of-work implementation |
| [node-postgres pool](https://node-postgres.com/apis/pool) | Pool sizing, timeouts, connection lifecycle |
| [Pino](https://getpino.io/) | Structured logging and redaction |
| [pino-http](https://github.com/pinojs/pino-http) | Request logging and correlation |
| [Helmet](https://helmetjs.github.io/) | Security headers |
| [Joi](https://joi.dev/) | Schema validation and external rules |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | Signing/verification options, algorithm pinning |
| [bcrypt (node.bcrypt.js)](https://github.com/kelektiv/node.bcrypt.js) | Cost factor and input limits |
| [ioredis](https://github.com/redis/ioredis) | Reconnect/ready events, pub/sub |
| [SendGrid Node.js](https://github.com/sendgrid/sendgrid-nodejs) | Email adapter behavior |
| [OpenAPI Specification 3.1](https://spec.openapis.org/oas/v3.1.0.html) | API contract |
| [Spectral](https://stoplight.io/open-source/spectral) | OpenAPI linting |

### 14.4 PostgreSQL and Performance Sources

| Source | Use in this document |
| --- | --- |
| [PostgreSQL: Indexes](https://www.postgresql.org/docs/current/indexes.html) | Index design and trade-offs |
| [PostgreSQL: Index Types](https://www.postgresql.org/docs/current/indexes-types.html) | B-tree, GIN, trigram suitability |
| [PostgreSQL: `pg_trgm`](https://www.postgresql.org/docs/current/pgtrgm.html) | Leading-wildcard search indexes |
| [PostgreSQL: `EXPLAIN`](https://www.postgresql.org/docs/current/using-explain.html) | Query-plan validation |
| [PostgreSQL: `pg_stat_statements`](https://www.postgresql.org/docs/current/pgstatstatements.html) | Query performance monitoring |
| [PostgreSQL: Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) | Unique, FK, check, not-null as correctness authority |
| [PostgreSQL: Transactions](https://www.postgresql.org/docs/current/tutorial-transactions.html) | Atomicity and rollback |
| [PostgreSQL: Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html) | Serialization/deadlock behavior and retries |
| [PostgreSQL: `CREATE INDEX`](https://www.postgresql.org/docs/current/sql-createindex.html) | `CONCURRENTLY`, lock behavior |
| [PostgreSQL: Routine Vacuuming](https://www.postgresql.org/docs/current/routine-vacuuming.html) | Autovacuum, bloat |
| [PostgreSQL: Connection Settings](https://www.postgresql.org/docs/current/runtime-config-connection.html) | `max_connections`, timeouts |
| [PostgreSQL: Client Connection Defaults](https://www.postgresql.org/docs/current/runtime-config-client.html) | `statement_timeout`, `lock_timeout`, `idle_in_transaction_session_timeout` |
| [PostgreSQL: Backup and Restore](https://www.postgresql.org/docs/current/backup.html) | Backup strategy |
| [PostgreSQL: Continuous Archiving / PITR](https://www.postgresql.org/docs/current/continuous-archiving.html) | Point-in-time recovery |
| [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | Only if multi-tenancy is adopted |
| [PgBouncer features](https://www.pgbouncer.org/features.html) | Transaction pooling and connection budget |
| [PgBouncer configuration](https://www.pgbouncer.org/config.html) | Pool modes and limits |

### 14.5 Testing, Load, and Quality Sources

| Source | Use in this document |
| --- | --- |
| [Vitest](https://vitest.dev/) | Unit/integration runner configuration |
| [Supertest](https://github.com/ladjs/supertest) | HTTP integration testing |
| [Testcontainers for Node.js](https://node.testcontainers.org/) | Isolated PostgreSQL/Redis for tests |
| [Playwright](https://playwright.dev/) | E2E browser tests |
| [Artillery](https://www.artillery.io/docs) | Load-test scenarios and thresholds |
| [k6](https://k6.io/docs/) | Alternative load-testing option |
| [StrykerJS](https://stryker-mutator.io/) | Mutation testing for critical modules |
| [OWASP ZAP](https://www.zaproxy.org/) | DAST |
| [OWASP Dependency-Check](https://owasp.org/www-project-dependency-check/) | Dependency vulnerability scanning |
| [GitHub Actions security hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions) | Action pinning, least privilege, untrusted input |
| [SLSA](https://slsa.dev/) | Supply-chain levels and provenance |
| [Trivy](https://github.com/aquasecurity/trivy) | Container/filesystem scanning |
| [Syft](https://github.com/anchore/syft) | SBOM generation |
| [Sigstore/cosign](https://github.com/sigstore/cosign) | Image signing/verification |

### 14.6 Operations and Architecture Sources

| Source | Use in this document |
| --- | --- |
| [The Twelve-Factor App](https://12factor.net/) | Config, stateless processes, logs, disposability |
| [OpenTelemetry documentation](https://opentelemetry.io/docs/) | Traces, metrics, logs correlation |
| [Prometheus documentation](https://prometheus.io/docs/) | Metrics and alerting model |
| [Grafana documentation](https://grafana.com/docs/) | Dashboards |
| [Kubernetes liveness/readiness probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/) | Health endpoint design |
| [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/) | Production image |
| [Distroless images](https://github.com/GoogleContainerTools/distroless) | Minimal runtime option |
| [Docker build best practices](https://docs.docker.com/build/building/best-practices/) | Layer caching, non-root, `.dockerignore` |
| [PostgreSQL high availability](https://www.postgresql.org/docs/current/high-availability.html) | Replication/failover options |

### 14.7 Repository Evidence Index

| File / area | What it supports |
| --- | --- |
| `README.md` | Documented features, setup, endpoint examples, claims to verify |
| `package.json` | Scripts, dependencies, test/lint/build commands |
| `.env.example` | Configuration surface and unsafe defaults |
| `src/index.ts` | Cluster mode, server startup, worker shutdown |
| `src/app.ts`, `src/bootstrap.ts` | Middleware order, cache warm-up, subscriptions |
| `src/routes/v1.ts` | API composition |
| `src/config/environment.ts` | Untyped env parsing, `NaN`/empty-secret behavior |
| `src/config/database.ts` | Pool configuration, DB executor type |
| `src/config/http.ts` | CORS, Helmet, compression, request logging |
| `src/config/logger.ts` | Pino configuration and missing redaction |
| `src/config/redis.ts`, `src/shared/redis/*` | Cache crypto, pub/sub, reconnect behavior |
| `src/common/middleware/authentication.middleware.ts` | JWT verification, session check, `tid: 0` bypass |
| `src/common/middleware/authorization.middleware.ts` | Role/route guard enforcement, bypass claim |
| `src/common/middleware/two-factor-authentication.middleware.ts` | `tfa` claim enforcement |
| `src/common/middleware/request.middleware.ts` | XSS sanitization, pagination context |
| `src/common/middleware/error.middleware.ts` | Error handling and logging |
| `src/common/utils/security.util.ts` | bcrypt/AES-GCM primitives |
| `src/shared/validations/database/unique.ts` | Scalar/composite uniqueness defect |
| `src/shared/validations/database/exists.ts` | Existence validator |
| `src/modules/auth/authentication/*` | Login, register, logout, token issuance, session repository |
| `src/modules/auth/password-recovery/*` | Recovery flow, enumeration, transaction boundary |
| `src/modules/auth/two-factor-authentication/*` | OTP issuance/verification, lockout |
| `src/modules/users/*` | User CRUD, account flows, validations, routes |
| `src/modules/system/settings/*` | Settings CRUD, cache, browse filters |
| `src/modules/system/roles/*` | Role CRUD and deletion behavior |
| `src/modules/system/route-guards/*` | Route-guard model, cache, browse filters |
| `database/migrations/*` | Schema, constraints, indexes, cascade behavior |
| `database/seeds/*` | Seed idempotency and default credentials |
| `tests/integration/*`, `src/**/*.spec.ts` | Test inventory and isolation model |
| `tests/load/*` | Load profiles and thresholds |
| `.github/workflows/test.yml` | CI scope and gaps |
| `Dockerfile`, `compose.yml` | Container and local runtime posture |

### 14.8 Source-to-Claim Mapping

| Claim area | Primary sources |
| --- | --- |
| Access control, BOLA, function-level authorization | OWASP Top 10 A01, API Top 10 API1/API5, ASVS V8 |
| Authentication, lockout, MFA, password policy | OWASP Authentication, NIST SP 800-63B-4, ASVS V6 |
| Session/token lifecycle, JWT | OWASP Session Management, RFC 7519, RFC 8725, RFC 9700, ASVS V7 |
| Password storage | OWASP Password Storage, NIST SP 800-63B-4 |
| CORS/CSRF/XSS | OWASP CORS/CSRF/XSS cheat sheets, ASVS V13/V14 |
| Security configuration/secrets | OWASP Top 10 A02, Secrets Management, ASVS V13/V11 |
| Logging/audit/error handling | OWASP Logging/Error Handling, ASVS V16, OWASP Top 10 A09 |
| Supply chain | OWASP Top 10 A03/A08, SLSA, GitHub Actions hardening, Trivy/Syft |
| Database correctness/performance | PostgreSQL docs, PgBouncer docs, `pg_trgm`, `EXPLAIN`, `pg_stat_statements` |
| Testing/quality | Vitest/Supertest/Testcontainers/Artillery docs, OWASP WSTG |
| Operations | 12-Factor, OpenTelemetry, Kubernetes probes, Docker docs |
| Refresh tokens/rotation | RFC 9700, OWASP Session Management, ASVS V7 |
| TOTP/WebAuthn/SSO | RFC 6238, W3C WebAuthn, OpenID Connect Core |

### 14.9 Research Limitations

- No dynamic testing, fuzzing, penetration test, SAST/DAST, dependency audit, container scan, or benchmark was executed for this document.
- No production metrics, query plans, or load-test results were available. Performance statements are code-and-schema based.
- Standards and library versions change. Re-validate against the versions actually deployed.
- The repository may have changed after this review; re-run the evidence checks before acting.
- Estimates are planning ranges, not commitments. They depend on team familiarity, review latency, and organizational constraints.

---

## Appendix A — Quick Reference: P0 Fix Order

If you do only the minimum to make the system safe to demo internally:

1. F-01/F-02 — validation and admin CRUD.
2. F-03/F-04 — one token contract, live sessions, status checks.
3. F-05 — stop role deletion from deleting users.
4. F-09/F-10 — fail-fast config and CORS allowlist.
5. F-06 — rate-limit auth endpoints.

Do not expose the API to untrusted users before these are complete.

## Appendix B — Files That Should Change (by feature)

| Feature | Likely files |
| --- | --- |
| F-01/F-02 | `src/shared/validations/database/unique.ts`, `src/modules/users/validations/*`, `src/modules/users/user.routes.ts` |
| F-03/F-04 | `src/modules/auth/authentication/*`, `src/modules/users/services/account.service.ts`, `src/common/middleware/authentication.middleware.ts`, session migration |
| F-05 | `database/migrations/*`, `src/modules/users/user.repository.ts`, `src/modules/users/controllers/user.controller.ts`, role/setting/route-guard services |
| F-06 | New rate-limit middleware, `src/config/http.ts`, `src/config/redis.ts`, auth routes |
| F-07/F-08 | `src/modules/auth/two-factor-authentication/*`, `src/modules/auth/password-recovery/*`, migrations |
| F-09/F-10 | `src/config/environment.ts`, `src/config/http.ts`, `.env.example`, `src/index.ts` |
| F-11/F-12 | New auth/session/verification services, migrations, routes |
| F-13/F-14 | `src/common/middleware/authorization.middleware.ts`, route-guard/role/setting controllers and repositories, seeds |
| F-15 | `src/common/middleware/error.middleware.ts`, `src/config/database.ts`, services |
| F-16/F-17/F-18 | `src/shared/redis/*`, `src/config/logger.ts`, `src/app.ts`, new health routes |
| F-19/F-20 | New audit/outbox modules, migrations, worker entrypoint |
| F-21–F-23 | `src/config/database.ts`, migrations, `.github/workflows/*`, `Dockerfile`, `compose.yml`, `.dockerignore` |
| F-24–F-30 | Docs/OpenAPI, tests, new policy/idempotency/search modules |

## Appendix C — Glossary

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



