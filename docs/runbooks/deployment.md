# Runbook: Deployment and rollback

## Scope

How to release a change and how to undo it.

## Before deploying

1. **CI is green.** The pipeline runs the typecheck, the lint, the
   build, the tests with coverage, the dependency audit, and the image
   scan. A red pipeline blocks the release.
2. **The migration is reviewed.** A schema change needs its own
   migration, registered in `src/config/migrator.ts`, with a `down` and
   a documented compensating action. See
   [`migrations.md`](migrations.md).
3. **The configuration is ready.** Any new environment variable exists
   in the secret manager and in `.env.example` before the code that
   reads it is deployed. Configuration before code.
4. **The release note says what changed.** A behaviour change needs an
   entry in the changelog and, for an API change, an update to
   `docs/openapi.yaml`.

## Deploying

1. **Back up.** Take a snapshot of the database before a migration.
2. **Run the migration.** One job, once, before the new instances
   receive traffic:

   ```bash
   npm run db:migrate
   ```

3. **Roll the instances.** Deploy the new image to one replica first,
   then wait for it to become ready:

   ```bash
   curl -s https://<host>/health/ready
   ```

4. **Verify.** Run the smoke checks:

   ```bash
   curl -s https://<host>/health/live
   curl -s -X POST https://<host>/api/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"username":"<user>","password":"<password>"}'
   curl -s https://<host>/metrics | head -20
   ```

5. **Watch for one traffic cycle.** Error rate, p95 latency,
   authentication failures, the outbox queue depth and the database
   pool size.

6. **Roll the rest.** If the canary is healthy, roll the remaining
   replicas.

## Rolling back

1. **Stop the rollout.** Do not continue to the next replica.
2. **Deploy the previous image.** The previous version must be able to
   run against the current schema: this is why migrations follow the
   expand/contract rule. A rollback must not require reversing a data
   migration.
3. **Roll the migration back** only if the `down` is safe and the
   release note says so. A migration that has already been applied to
   production data is usually left in place.
4. **Verify** with the same smoke checks.
5. **Record** what was rolled back and why.

## Post-deployment

- Watch the dashboards for at least one traffic cycle.
- Check the outbox drained and the audit trail recorded the deployment
  events.
- Confirm that the alerts did not fire.

## Feature flags

Behaviour changes that cannot be deployed atomically (a new token
model, a new TFA policy, soft delete) should be behind a flag so they
can be enabled gradually and disabled without a rollback. The flags
must be removed once the behaviour has stabilised.
