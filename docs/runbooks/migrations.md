# Runbook: Migrations

## Scope

How to apply a schema change to a running deployment, and how to undo
it.

## Before you start

- Migrations are a **separate deployment step**. The application never
  runs migrations on boot, because several replicas would race against
  the same change.
- Migrations are registered explicitly in `src/config/migrator.ts`. A
  new file is not executed until it is registered, in timestamp order.
- Migration files must be named `YYYYMMDDHHmmss_descriptive_action_and_table.ts`
  (14-digit timestamp plus lowercase snake_case action and table name)
  with a unique timestamp prefix. Examples:
  `20261111120000_create_users_table.ts`,
  `20261111121500_add_email_to_users.ts`.
- Every migration has an `up` and a `down`. A `down` is the rollback
  path for an unreleased migration.

## Applying a migration

1. **Create the file.**

   ```bash
   npm run make:migration
   ```

2. **Write the migration.** Follow the rules below.

3. **Register it** in `src/config/migrator.ts` (import plus an entry in
   `MIGRATIONS`, in timestamp order).

4. **Test it on a production-like snapshot**, not on the live database.

   ```bash
   npm run db:migrate
   npm run db:seed
   npm run test:run
   ```

5. **Take a backup or snapshot** before the production run.

6. **Run it once**, before the new instances receive traffic:

   ```bash
   npm run db:migrate
   ```

7. **Verify** with a read/write probe and the health endpoints.

## Rules

- **Expand, backfill, contract.** Add the new column or table as
  nullable, backfill in batches, deploy the code that writes both
  paths, then enforce `NOT NULL` or the constraint, then remove the old
  path. Never combine a destructive change with the first deploy that
  uses it.
- **Keep backfills idempotent and batched.** A backfill that runs twice
  must be safe, and it must not lock a large table for the duration.
- **`CREATE INDEX CONCURRENTLY` cannot run inside a transaction.**
  Kysely runs each migration in a transaction, so the shipped
  migrations create indexes non-concurrently. For a large production
  table, apply the index manually with `CREATE INDEX CONCURRENTLY`
  during a maintenance window and make the migration a no-op.
- **Use `ON DELETE RESTRICT` for new foreign keys** that reference a row
  a user might still need.
- **Every migration needs a `down`.** If a change cannot be reversed,
  document the compensating action in the migration header and in this
  runbook.

## Rolling back

1. **Unreleased migration:** run `npm run db:reset` on the target
   environment, or apply the `down` function directly.
2. **Released migration:** deploy the previous application version and
   apply the `down` function. The code rollback must not depend on
   reversing a data migration — that is why the rules above exist.
3. If the `down` would lose data, take a decision explicitly and record
   it in the incident log.

## Inspecting the state

```sql
SELECT name, executed_at FROM kysely_migration ORDER BY name;
```

## Emergency: a migration is stuck

- Check for a blocked lock:
  `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';`
- The pool sets `lock_timeout` (5 s by default) and
  `statement_timeout` (15 s), so a stuck migration fails rather than
  holding a connection indefinitely.
