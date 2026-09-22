# HR database and audit repairs

The active migrations now contain an HR-only catalog baseline followed by the
22 September 2026 access and workflow repairs. The original SQL files are
preserved byte-for-byte in `legacy_migrations/` for historical reference. That
old chain was not replayable: it referred to missing tables/functions and
contained incompatible recruitment schemas.

The baseline includes HR tables, constraints, indexes, functions, triggers,
views, grants and policies. It contains no employee/candidate records. Supabase
owns the `auth` and `storage` platform schemas; other applications in the shared
project remain outside this repository's baseline.

## Fresh environments

Run the two active migrations in filename order against a new Supabase database.
Both migrations are required. The baseline reproduces the previous policy state;
the second migration closes the audited access gaps. Provision HR identities
through the normal administrative workflow after schema setup.

For the isolated regression suite, start a disposable PostgreSQL 17 container:

```sh
docker run --name hr-audit-postgres-20260922 --detach \
  --env POSTGRES_PASSWORD=hr-local-verification-only \
  --env POSTGRES_DB=hr_audit \
  --publish 127.0.0.1:55439:5432 postgres:17
npm run test:db
```

The runner is restricted to that local container. It creates a temporary database,
supplies minimal Auth/Storage platform contracts, replays the migrations, tests
an upgrade with existing rows, exercises HR roles with fixture data, and removes
only its own temporary database. It never reads `.env` or a linked project's
connection. This tests PostgreSQL behavior, not the hosted Storage HTTP service.

## Existing production project

**Do not execute the baseline on an existing database. Do not reset production.**
The baseline is a schema-history replacement, not an in-place upgrade.

The repair is prepared locally; this work has not changed production policies,
storage settings, migration history, records, or deployed Edge Functions.

Use a coordinated release:

1. Deploy the updated web client and distribute updated Electron bundles. Existing
   desktop releases embed the old public document URLs and do not auto-update.
   The new document code also works while the bucket is still public. Interview
   scheduling needs both the client change and the database migration.
2. Deploy `visit-summary`, `admin-reset-password`, and `admin-delete-user`, including
   their relative `_shared/hrAuth.js` import. Keep JWT verification enabled.
3. Confirm `interview_schedules` still has no legacy rows. The repair deliberately
   aborts if populated bigint interview references have not been mapped to UUID
   applications; it never guesses a mapping or deletes those rows.
4. Apply only `20260922065623_enforce_hr_access_and_repair_workflows.sql`, as one
   transaction. It scopes RLS, fixes the interview relationship and its views,
   protects approval/review fields, updates metrics and monthly summary triggers,
   recalculates existing attendance totals, and makes `employee-documents` private.
5. Verify a dedicated employee, scoped manager, and active administrator can use
   their intended workflows. Confirm anonymous and unrelated Auth accounts cannot
   read HR documents, summaries, candidate PII, or visit statistics. Confirm old
   public document links fail, and current downloads/short-lived previews succeed.

The Storage policy is restrictive for the HR document bucket, so bucket-agnostic
policies belonging to another application cannot grant HR access. Other buckets
retain their existing policy behavior. Previews expire after ten minutes;
downloads go through the authenticated Storage API. Existing issued signed URLs
remain valid until their expiration; existing CDN/browser caches may also persist.

## Migration history reconciliation

Before the next CLI `db push`, reconcile history explicitly against the verified
deployed schema. Archive the current migration-history rows first. Mark only the
superseded HR versions as reverted in metadata, then mark baseline version
`20260922065611` applied without executing it. Mark repair version `20260922065623`
applied only after its SQL has committed (or leave it pending for the CLI to apply).
Use `supabase migration repair <versions> --status reverted --linked` and
`supabase migration repair <version> --status applied --linked`; these commands
change history metadata, not schema or data. Check `supabase db push --dry-run`
before any subsequent push. Never clear another application's migration history.

The HR versions observed during the audit were `001`–`017`,
`20260726062417`, `20260726064032`, `20260726064139`, `20260726064351`,
`20260819072647`, `20260828072845`, `20260908071550`, `20260908075705`,
`20260908080558`, `20260908085246`, and `20260908085532`. Re-read remote history
before acting; several names/timestamps differed from the archived local files.

## Validation and remaining audit work

The repair suite passed 162 Node tests and 70 PostgreSQL assertions.
Coverage includes mapped and direct Auth identities, inactive/non-HR accounts,
approval bypass attempts, protected manager reviews, private document policies,
recruitment mutations/metrics, interview relationships, month boundaries in three
time zones, cross-month leave, migration rollback and existing-data backfill.
The updated Electron bundle also passed its offline native smoke checks,
including PDF worker startup and Blob export. An interactive browser check was
unavailable because no browser connection was available in this session. No
live sign-in or production write workflow was exercised.

Dependency upgrades and the broader source lint backlog are separate remaining
audit work. In particular, the existing jsPDF major upgrade needs PDF export
verification; `npm audit fix --force` proposes an incompatible ExcelJS downgrade.
Large raw-row attendance aggregations still need pagination or a server-side read
path to remove the existing API row-limit risk. No new application dependencies
were introduced in this repair.
