# Runbook: Backup and restore

## Scope

How to protect the database and how to recover from data loss.

## Scope and responsibility

The database is the system of record. The application never stores a
copy of the business data outside PostgreSQL (the Redis cache is a
derived copy and can be discarded at any time).

Backups, point-in-time recovery and the retention schedule are a
platform responsibility. This runbook describes the procedure the
application expects and the drills that must pass.

## Backup requirements

1. **Automated backups.** At least daily, with a retention window that
   satisfies the business recovery objectives.
2. **Point-in-time recovery.** Enabled, so a single mistaken `DELETE`
   or `UPDATE` can be rolled back to a moment in time.
3. **Off-site copies.** The backups must not live only on the database
   host.
4. **Encryption.** Backups are encrypted at rest and in transit.
5. **Least-privilege access.** Only the platform team and the incident
   commander can restore a backup.

## Restore drill (quarterly)

1. **Restore into an isolated environment.** Never restore over the
   production database.
2. **Restore the latest backup** and then replay the WAL up to a
   chosen point in time.
3. **Verify the schema.**

   ```sql
   SELECT count(*) FROM kysely_migration;
   ```

   The count must match the number of registered migrations. A missing
   migration means the backup predates it; apply the outstanding
   migrations to the restored copy.

4. **Verify the data.** Compare row counts for the critical tables
   (`users`, `authentication_tokens`, `roles`, `route_guards`,
   `settings`, `audit_logs`) with the source database.
5. **Run the application against the restored copy.** The smoke checks
   in [`deployment.md`](deployment.md) must pass.
6. **Record the drill**: the RTO and RPO achieved, the problems found
   and the follow-up actions.

## Recovery scenarios

### A single table was damaged

Restore the table into a scratch schema and copy the rows back:

```sql
CREATE SCHEMA restore;
```

Compare and copy, then verify the constraints before switching over.

### The whole database was lost

1. Provision a new instance with the same configuration.
2. Restore the backup and replay the WAL.
3. Apply any migration that ran after the restore point.
4. Point the application at the restored instance.
5. Verify with the smoke checks and the health endpoints.

### A user was deleted by mistake

A user deletion is a soft delete: the row is still present with
`deleted_at` set. Clear the column and re-check the user's status and
role. See [`incident-response.md`](incident-response.md).

## What is not backed up

- The Redis cache. It rebuilds from the database.
- The audit trail is in the database and follows the same backup
  policy; it must not be pruned more aggressively than the retention
  window without a decision.
- Locally generated files: there are none.
