**Attendance takeover audit — 26 September 2026**

**Follow-up completed:** Section 10 records the subsequent authorized fixes. Its results supersede the remaining-failure/limitation statements in the original audit below; the earlier claim classifications remain a record of the takeover snapshot.

This audit used the workspace as received, a separate Git HEAD snapshot, read-only production catalog queries, and disposable PostgreSQL databases. No production migration/data change, commit, or push was performed. The browser runtime returned no available browser; there is no interactive UI or rendered-export verification claim.

**1. Previous-agent claims, evaluated against the takeover snapshot**

| Material claim | Classification | Independently checked evidence |
| --- | --- | --- |
| One attendance interpretation already reached all screens and exports | FALSE | `reportExportHelpers` still summed raw entries; Excel chart and report composition had other raw sums. The new helper deduplicated by date without employee, so one person's leave could erase another person's hours. Time Tracking replaced service overtime-log totals with entry-only totals. |
| Approved request weekdays are clipped, overlaps deduplicated, regular/WFH suppressed and overtime retained | PARTIALLY VERIFIED | The original SQL body and single-employee helper did this. Cohort aggregation and remaining consumers did not. |
| Pending/rejected requests do not suppress attendance | VERIFIED | Original helper filters approved requests; service fill does too. Focused tests and SQL replay reproduced this. |
| Admin/manager edit and explicit revert/restore UI exists | VERIFIED | Manager-gated edit/revert controls, employee/date/status fields, unchecked restore toggle, and service methods exist. Interactive operation remains unverified. |
| Restoration reuses Fill Standard Hours | VERIFIED | `restoreStandardHoursForDates` calls `fillStandardHoursForAllEmployees`; it does not construct a second attendance insert implementation. |
| Restore never conflicts with manual/non-regular rows | PARTIALLY VERIFIED | Original fill read only the requested hour type. A WFH or overtime row at 09:00 could collide with the actual unique key. Restore failures could be presented as zero rows restored. |
| Approval cleanup retains the exact audited predicate | PARTIALLY VERIFIED | Migration DELETE was narrow. Client cleanup selected IDs and deleted them later without rechecking predicates; its time parser accepted fractional near misses as exact times. |
| Production's actual canonical function is `public.update_time_tracking_summary(text,int,int)` | VERIFIED | Read-only `pg_get_functiondef`, trigger definitions, owner/ACL/RLS catalogs; captured fixture included in this repository. |
| Production function was INVOKER; draft changed it to DEFINER, empty search_path | VERIFIED | Production `prosecdef=false`, owner postgres, `search_path=public, pg_temp`; original draft explicitly said DEFINER. |
| DEFINER is necessary and preserves production security | FALSE | Production allows summary writes. The repository's undeployed access repair revokes them and delegates through a private definer. Passing that different local schema does not justify elevating production. |
| Original inline authorization exactly matches every permitted caller | PARTIALLY VERIFIED | Own/manage checks use real production helpers, but JWT role / postgres-session shortcuts were broader than actual SQL-role checks. No production-like privilege proof accompanied the original change. |
| Signature/owner/EXECUTE grants remain unchanged by replacement | VERIFIED | Signature matches. CREATE OR REPLACE preserves owner and ACL; final tests explicitly compare both. This alone does not preserve RLS behavior after a definer change. |
| No dependency on missing `private.is_hr_service_context` | VERIFIED | Draft summary inlined checks; live catalog has no such helper. Final summary also does not call it. |
| `private.refresh_time_tracking_summary` was only a local draft artifact | FALSE | It is created by the committed but undeployed access-repair migration, with a public SQL wrapper and row-trigger callers. It is absent in production. |
| OLD/NEW dates and employees all refresh | VERIFIED | Original row trigger unions all OLD/NEW ranges and reaches every month. It also recalculated pending, rejected, metadata-only and unchanged coverage unnecessarily. |
| Only genuinely affected employee/months refresh | PARTIALLY VERIFIED | No database-wide event loop, but original trigger was too broad and migration included unrelated standalone-entry periods. |
| BEFORE INSERT guard drops only generated weekday regular 09:00–17:00 rows on approved leave | VERIFIED | Exact SQL predicates, invoker trigger, same employee/range, manual/non-regular/weekend near misses; actual INSERT RETURNING behavior tested. |
| Guard plus cleanup closes approval/fill concurrency | PARTIALLY VERIFIED | It catches already-visible approvals, not two concurrent transactions with mutually invisible writes. There was no transaction lock or atomic future-approval cleanup. |
| Unique `(employee_id,date,clock_in)` prevents duplicate generated rows | VERIFIED | Actual constraint inspected; DB49 exercises a real unique violation; service sequential fill/restore tests preserve one row. Concurrent duplicate fills can still return a uniqueness error. |
| Migration captures targets before cleanup and uses narrow DELETE | VERIFIED | Original order and predicate inspected; seeded replay verifies exact removed rows and preserved near misses. |
| Unrelated historical months are untouched | FALSE | Original backfill unioned approved standalone entry months. Read-only production query found 6 approved-request employee/months and 2 additional standalone-only employee/months. |
| Eight approved standalone on_leave rows exist outside approved requests | VERIFIED | Read-only production aggregate counted eight, all outside request coverage. Their provenance cannot be inferred from that fact alone. |
| Approved-only standalone behavior matched historical production | FALSE | Historical production SQL ignored standalone rows as leave totals; old JS counted pending as well as approved. The user explicitly selected approved-only, without suppressing regular hours. |
| Half-day leave is represented by reason tags, whole weekdays still count | VERIFIED | Current form/schema use reason text, no half-day attendance fraction column. No fractional-day policy was introduced. |
| Deferred roster/profile portraits and five-minute cache exist | VERIFIED | Roster omits photo, App schedules portraits after roster, AuthContext ends loading before avatar fetch, cache TTL is 300000 ms. |
| Portrait cache is harmless | PARTIALLY VERIFIED | Original cache had no update/delete/auth invalidation and could serve stale photos. It remains one batch, not card lazy loading. |
| Report request rows retain stored days_count while totals are canonical | PARTIALLY VERIFIED | Full-request days_count display is present. Initial canonical-total claim was false for multiple exports/charts. Full request duration may be mistaken for period leave when a cross-month row appears in a monthly report. |
| 32/32 focused, translations pass, full suite 202 pass/2 fail, local DB 77 pass | VERIFIED | Reproduced from the takeover snapshot. Counts alone did not cover security, deletion near misses, targeted invalidation or real races. |
| Two password-recovery failures are unrelated to leave work | PARTIALLY VERIFIED | They were already failing at takeover with `Unexpected import: ./themeToggle`; Git HEAD passes 179/179. They are regressions in pre-existing workspace restyle changes, not baseline failures. Authorship/timing cannot be proved from an uncommitted diff. |
| Eslint has no new errors | FALSE | Initial touched-file command exited 1: 13 errors, 12 warnings; six errors were in new/modified attendance tests. |
| Original migration was safe to apply | FALSE | Unnecessary production elevation, broader historical backfill, and unproved race boundary prevented that assessment. |
| No production application / commit / push occurred in the previous agent's work | PARTIALLY VERIFIED | Target migration/guard absent from production and work is uncommitted. A previous agent's complete action history cannot be established from the final workspace. This takeover performed none of those actions. |

**2. Corrections made**

- Keep production INVOKER, retain its owner and ACL, qualify source objects, reject unauthorized direct summary calls. Preserve the existing effective definer boundary only for the verified old same-owner SQL wrapper in the undeployed hardened schema (or a public function already marked definer).
- Canonical JS sets are keyed by employee/date, not date alone. Export statistics, employee performance totals, Excel/PDF chart values, report composition, directory figures, demo calculations and the unused work-days modal use the shared attendance calculation. Service totals retain overtime logs, and valid zero values remain zero.
- Use local calendar keys for month/week boundaries and fix a week spanning two months. Directory and leave-management daily indicators use distinct approved weekday coverage.
- Refresh the symmetric difference of OLD/NEW approved employee/date coverage, excluding dates still covered by another approved request. Preserve overtime OLD/NEW refreshes. Metadata-only, pending/rejected-only and fully overlapped leave changes do not update summaries.
- Serialize generated inserts, leave reconciliation and summary recomputation using the same per-employee transaction advisory lock. Future approval cleanup commits within the leave trigger. Remove the delayed production client DELETE, which could otherwise erase concurrently restored hours. Demo cleanup retains the exact marker/time/weekday predicate, including fractional-time near misses.
- Keep RETURN NULL for disallowed generated inserts: it leaves the other batch rows intact. Service fill counts the actual returned rows, so it does not report skipped rows as created.
- Restoration uses the normal fill helper, checks all existing types for overlapping attendance / the shared clock-in unique key, respects other approvals and reports partial failure after a committed leave change. It remains explicit and defaults off.
- Retain deferred login portraits, cache one batch, invalidate on photo/create/delete/auth lifecycle changes, and prevent invalidated in-flight responses from repopulating the cache.
- Target historical repair only to approved-request weekday months. The user-selected standalone-entry rule applies to current/future calculations without expanding this backfill.

No new dependencies. The unrelated password-screen restyle and its test-loader failures were not rewritten. Existing source lint debt outside the repaired attendance logic remains visible.

**3. Final file manifest**

Files revised or added by this takeover (some already contained previous-agent work):

- `scripts/test-hr-database.mjs`
- `src/App.jsx`
- `src/components/controlPanel.jsx`
- `src/components/dashboard.jsx`
- `src/components/employeeDirectory.jsx`
- `src/components/leaveManagement.jsx`
- `src/components/reports.jsx`
- `src/components/timeClockEntry.jsx`
- `src/components/timeTracking.jsx`
- `src/components/userEmployeeCard.jsx`
- `src/components/workDaysModal.jsx`
- `src/services/employeeService.js`
- `src/services/timeTrackingService.js`
- `src/utils/attendanceRules.js`
- `src/utils/reportExportHelpers.js`
- `supabase/README.md`
- `supabase/migrations/20260925093907_exclude_approved_leave_from_worked_days.sql`
- `tests/attendanceRules.test.js`
- `tests/auditServiceRegressions.test.js`
- `tests/database/attendance-fixture.sql`
- `tests/database/attendance-production-catalog.json`
- `tests/database/attendance-regressions.sql`
- `tests/employeePhotoCache.test.js`
- `tests/reportExportHelpers.test.js`
- `Read/ATTENDANCE_TAKEOVER_AUDIT.md`

Existing changes retained byte-for-byte from takeover:

- `AGENTS.md`
- `src/components/AdminTimeEntry.jsx`
- `src/components/ResetPassword.jsx`
- `src/components/deleteEmployeeManager.jsx`
- `src/contexts/AuthContext.jsx`
- `src/translations/additions/de.js`
- `src/translations/additions/en.js`
- `src/translations/additions/es.js`
- `src/translations/additions/fr.js`
- `src/translations/additions/jp.js`
- `src/translations/additions/kr.js`
- `src/translations/additions/ru.js`
- `src/translations/additions/th.js`
- `src/translations/additions/vn.js`
- `src/translations/en.js`
- `tests/database/hr-access.sql`
- `tests/helpers/queryFixture.js`

`ResetPassword.jsx` is unrelated scope already present. `AGENTS.md` is the supplied instruction change. `AuthContext.jsx` and `deleteEmployeeManager.jsx` are related deferred-portrait work retained from before takeover. Translation/standard-fill copy and existing regression-fixture improvements are retained.

**4. Exact database objects and privilege boundary**

Production was read-only throughout. Current live PostgreSQL is 17.4; audit session and database default isolation are READ COMMITTED. The live public summary function remains the old INVOKER until this migration is applied.

Prepared target on the audited production schema:

| Object | Final target attributes / caller |
| --- | --- |
| `public.update_time_tracking_summary(text,integer,integer) RETURNS void` | PL/pgSQL, SECURITY INVOKER, owner postgres retained, `search_path=''`; EXECUTE remains PUBLIC, postgres, anon, authenticated, service_role. |
| `public.trigger_update_summary() RETURNS trigger` | PL/pgSQL, SECURITY INVOKER, owner and existing ACL retained, `search_path=''`; bound to `update_summary_on_leave` and `update_summary_on_overtime`, AFTER INSERT/UPDATE/DELETE ROW. |
| `public.skip_generated_hours_on_approved_leave() RETURNS trigger` | PL/pgSQL, SECURITY INVOKER, empty search_path, owner is the migration role (postgres in verified replay); normal PUBLIC EXECUTE default. PostgreSQL trigger functions cannot be used as ordinary data RPCs. |
| `time_entries_skip_bulk_fill_on_leave` | BEFORE INSERT FOR EACH ROW on `public.time_entries`, calls the new guard. |
| `update_summary_on_time_entry_insert` | Existing AFTER INSERT STATEMENT, NEW TABLE `new_time_entries`, calls `public.refresh_time_entry_summaries_after_insert()` then the public summary. |
| `update_summary_on_time_entry_update` | Existing AFTER UPDATE STATEMENT, OLD TABLE `old_time_entries` / NEW TABLE `new_time_entries`, calls `public.refresh_time_entry_summaries_after_update()` then the public summary for both sides. |
| `update_summary_on_time_entry_delete` | Existing AFTER DELETE STATEMENT, OLD TABLE `old_time_entries`, calls `public.refresh_time_entry_summaries_after_delete()` then public summary. |
| Three `refresh_time_entry_summaries_after_*()` functions | Unchanged INVOKER, owner postgres, original ACL and `search_path=public, pg_temp` retained; transition relations are supplied by PostgreSQL. |
| `private.refresh_time_tracking_summary(text,integer,integer)` | Dropped if present after replacing its known callers. No CASCADE; no second summary body remains. |

The alternate repository upgrade path has a same-owner private definer already behind the public RPC. In that specific verified state, the migration moves its existing effective elevation into the public body and retains the prior restricted ACL (postgres/authenticated/service_role; no PUBLIC/anon). Direct summary writes in that state are revoked, so retaining the existing effective boundary is necessary for legitimate source-table triggers and own-employee RPCs to keep working. This does not elevate production's direct INVOKER function.

Ordinary authenticated callers may invoke the public summary directly for their own active employee or a target accepted by the existing `private.can_manage_employee`. The function accepts no caller-supplied totals. Outside employee IDs, inactive identities, anonymous access, no-UID authenticated sessions, and forged JWT role strings fail with 42501. Actual SQL service_role, postgres and supabase_admin roles are trusted. The check uses permission-checked `current_setting('role')`, falling back to session_user only when no role is set; merely having a postgres session underneath SET ROLE authenticated is insufficient. RLS remains effective in production's INVOKER body. The alternate definer boundary is covered by the same authorization tests and temp-object shadowing test.

Production's pre-existing broad summary SELECT/write policies and its weaker source approval guards remain unchanged. In particular, the older production approval guard is only BEFORE UPDATE and protects fewer fields than the undeployed access-hardening migration. This attendance migration is not a general HR access-policy repair.

**5. Exact migration / backfill / DELETE behavior**

Apply only `supabase/migrations/20260925093907_exclude_approved_leave_from_worked_days.sql` as one transaction to the audited target, as postgres/the verified object owner. Do not execute the baseline on production, blindly push all pending migrations, or deploy this attendance client before its transactional cleanup trigger exists.

The migration:

1. Replaces the existing public calculation body and rewrites the existing leave/overtime trigger function, retaining signature, owner and existing grants.
2. Counts the distinct union of approved-request weekdays clipped to the month plus approved standalone leave-entry dates. A matching request and entry on one employee/date count once. Standalone entries never add hours and do not suppress another regular entry. Pending/rejected requests do not count or suppress. Pending/approved time/overtime entries retain existing contribution rules.
3. Adds the generated-row BEFORE INSERT guard and shares one transaction lock key (`hashtextextended('hr.attendance:' || employee_id,0)`) across guard, leave reconciliation and summary computation.
4. Captures distinct employee/months with approved-request weekdays in a transaction-local temporary table BEFORE deleting anything. Standalone-only, pending-only, weekend-only and unrelated historical months are excluded.
5. Deletes only rows satisfying **all** of: same employee as an approved request; inclusive request date; Monday–Friday; `hour_type='regular'`; `clock_in=time '09:00'`; `clock_out=time '17:00'`; `notes LIKE 'Standard hours filled by admin:%'`. There is no broad status-based attendance deletion. Manual notes, null notes, wrong marker, fractional clock-in, different clock-out, overtime/WFH, weekend, other-employee and out-of-range rows survive.
6. Recomputes only captured pairs. Existing time-entry statement triggers may recompute the same affected pairs during cleanup; they do not expand the affected set. Future approvals perform the same narrow DELETE within the leave write transaction.

The read-only production inventory at audit time found **6** approved-request employee/months, **2** standalone-only extra periods the old draft would have included, and **0** currently stored rows matching the exact cleanup predicate. These are observations, not hardcoded limits.

One successful transaction was replayed on both schema states, then the resulting functions, permissions, bindings, rows and summaries were tested. Re-execution in a new transaction succeeds, keeps one guard, deletes no already-removed rows, and preserves source rows and calculated values; affected summary `updated_at` values may change. Repeating the whole script twice inside the SAME outer transaction would collide with its ON COMMIT DROP temporary table and roll that transaction back. Use one migration transaction, not two concatenated copies.

**6. Required regression mapping**

`AS` = `tests/auditServiceRegressions.test.js`; `AR` = `tests/attendanceRules.test.js`; `EX` = `tests/reportExportHelpers.test.js`; `PC` = `tests/employeePhotoCache.test.js`. DB01–DB40 and DB43–DB49 are in `tests/database/attendance-regressions.sql`; DB41–DB42 are real concurrent sessions in `scripts/test-hr-database.mjs`. Every database case runs against BOTH schema states.

| Requirement | Specific executable coverage |
| --- | --- |
| Pending/rejected do not block fill | AS `pending and rejected leave do not block standard-hour fill` |
| Approved weekdays block fill; another employee unaffected | AS `bulk standard hours skip weekdays covered by approved leave`; DB19 |
| Weekends skipped by fill/restore; guard preserves weekend rows | AS `fill across a weekend skips only the approved weekdays`, `reverting an approval with restore recreates only the safe generated weekdays, once`; DB06/DB19 |
| Exact approval deletion and all near misses | DB06 migration cleanup; DB25/DB26 future approval; AS `demo approval cleanup enforces every predicate and keeps all near misses` |
| Manual exact 09–17 and 09:12–17:08 remain | DB06/DB19/DB22/DB26; AS demo cleanup matrix |
| Overtime/WFH/another employee stay stored | DB06/DB19/DB26; AS restore and demo cleanup cases |
| Approval twice harmless | DB12; AS `demo: approving a multi-day leave removes only that employee's bulk weekdays` |
| Fill twice / restore twice no duplicates | AS `filling standard hours twice creates no duplicate generated rows`, repeated call in restore case; DB21/DB49 |
| Multi-row insert guard and truthful counts | DB19 actual INSERT RETURNING; AS `fill reports actual stored rows when the database insert guard skips part of a batch` |
| Sep30→Oct2 = Sep1/Oct2; pending = 0 | AS `leave from 30 Sep to 2 Oct counts one September day and two October days; pending counts nothing`; DB08–DB11 |
| Sep10–12 and Sep11–15 overlap counts 4 weekdays | AR weekday-set case; AS overlapping case; DB17/DB18 |
| Fully covered month days_worked stays 0 | AR fully-covered and `Time Tracking selection preserves zero worked days and complete service overtime logs`; AS stale-summary case; existing hr-access assertions plus DB20 |
| Leave + regular/WFH + overtime | AR/AS overtime-on-leave cases; DB07/DB20/DB24 |
| Approved standalone only; no regular suppression; no request duplication | AR `standalone leave shares the request date set without suppressing regular attendance`; DB23 |
| OLD + NEW range edits, Sep30→Oct2 to Oct5→Oct7 | DB13; AS demo edit with/without restore |
| Employee changed | DB14/DB36; AS `demo: changing approved employee restores OLD employee and cleans NEW employee only` |
| Pending/rejected→approved; approved→pending/rejected | DB10/DB15/DB45/DB46; AS status transition/revert cases |
| Delete approved leave | DB16 |
| Only genuinely affected periods | DB05/DB08/DB09/DB12/DB14/DB18; refresh table records actual writes |
| No restore by default | AS `reverting an approval without restore only changes the status`; DB15 |
| Explicit safe restore, overlaps, other approval, existing generated rows | AS restore-safe case, `restore skips overlapping WFH or non-regular 09:00 rows and keeps evening overtime`, `restore respects another overlapping approval and already generated attendance` |
| Restoration error does not look like success with zero created | AS `restoration failure is reported as partial success after the leave change commits` |
| No delayed production cleanup race after unapproval | AS `production approval relies on transactional trigger cleanup and never sends a delayed DELETE` |
| America/Los_Angeles and October1 | AR spawned timezone cases, local week/month boundaries; AS month-boundary subprocess tests; entire focused suite run with TZ set |
| Demo/production parity | AS `demo and production services calculate the same October attendance` |
| Employee-specific cohort totals; Excel/PDF/CSV helper totals | AR cohort case; EX `CSV Excel PDF totals and employee figures share employee-specific leave and overtime rules`; consumer wiring independently inspected |
| Actual statement-trigger insert/update/delete paths | DB03/DB19/DB30/DB43/DB44; original access suite |
| Overtime-log OLD/NEW update/delete | DB24/DB47/DB48 |
| ACL/owner/security/search_path and direct-RPC boundaries | DB01–DB04, DB27–DB40; captured production catalog comparison |
| Concurrent fill before approval and approval before fill | DB41–DB42, two sessions with observed advisory-lock waiting; stored rows, RETURNING counts and final summaries asserted |
| Cache TTL, invalidation, inflight lifecycle, roster photo omission | All three PC tests |

Tests that previously asserted the client's ID-only DELETE were changed to exercise the real demo cleanup implementation; production deletion is proven with SQL row-state assertions, not simulated trigger behavior in a JS mock. No interactive screen click/export rendering test is claimed.

**7. Commands and exact results**

| Command / context | Result |
| --- | --- |
| `git status --short`, full `git diff`, all changed-file/source/schema searches | Initial worktree snapshot saved; no staged changes; inspected existing caller and migration paths. |
| `npm test` in Git HEAD archive at `/private/tmp/hr-takeover-baseline` | exit 0, 179 tests passed, 0 failed. |
| `npm test` at takeover | exit 1, 202 passed / 2 failed out of 204. |
| `node scripts/test-hr-database.mjs` at takeover | exit 0, 77 assertions; original draft replayed only locally. |
| `TZ=America/Los_Angeles node --test --test-reporter=tap tests/attendanceRules.test.js tests/auditServiceRegressions.test.js tests/reportExportHelpers.test.js tests/employeePhotoCache.test.js` | exit 0, 61 passed / 0 failed. |
| `npm test` after final repairs | exit 1, 218 passed / 2 failed out of 220. |
| `node scripts/test-hr-database.mjs > /private/tmp/hr-takeover-db-final.log 2>&1` | exit 0; 77 existing assertions + 47 new SQL assertions and 2 concurrent cases per schema = 175 assertions/cases passed; two accidental-replay comparisons also passed. |
| `./node_modules/.bin/eslint src/components/reports.jsx src/contexts/AuthContext.jsx` in Git HEAD archive | exit 1; 7 errors / 8 warnings. All three errors still present after repair exist in this baseline. |
| Final eslint command below | exit 1; 3 errors / 18 warnings (required command FAILED). |
| `git diff --check` | exit 0, no whitespace errors. |
| Local isolated Vite server and browser bootstrap/discovery | Server started; Browser reported no browser available and empty discovery list. Server stopped; no UI result inferred. |

Final eslint invocation:

```sh
./node_modules/.bin/eslint scripts/test-hr-database.mjs src/App.jsx src/components/AdminTimeEntry.jsx src/components/ResetPassword.jsx src/components/controlPanel.jsx src/components/dashboard.jsx src/components/deleteEmployeeManager.jsx src/components/employeeDirectory.jsx src/components/leaveManagement.jsx src/components/reports.jsx src/components/timeClockEntry.jsx src/components/timeTracking.jsx src/components/userEmployeeCard.jsx src/components/workDaysModal.jsx src/contexts/AuthContext.jsx src/services/employeeService.js src/services/timeTrackingService.js src/translations/additions/de.js src/translations/additions/en.js src/translations/additions/es.js src/translations/additions/fr.js src/translations/additions/jp.js src/translations/additions/kr.js src/translations/additions/ru.js src/translations/additions/th.js src/translations/additions/vn.js src/translations/en.js src/utils/attendanceRules.js src/utils/reportExportHelpers.js tests/attendanceRules.test.js tests/auditServiceRegressions.test.js tests/employeePhotoCache.test.js tests/helpers/queryFixture.js tests/reportExportHelpers.test.js
```

Remaining eslint errors: `reports.jsx` no-control-regex at lines 2551 and 2619; `AuthContext.jsx` react-refresh/only-export-components at line 72. The takeover command initially had 13 errors / 12 warnings, including new attendance-test errors; those test errors are fixed. The required final lint command has not passed.

The two full-suite failures are both `tests/passwordRecoverySession.test.js` (test declaration line 131), failing while loading `ResetPassword.jsx` with `Unexpected import: ./themeToggle`. They were present at takeover, absent from Git HEAD, and untouched by attendance repairs. Translation coverage passes as part of the full run.

Required searches included `days_count`, `leave_days`, `days_worked`, `regular`, `wfh`, all leave types, summary function/table names, `SUM(`, `.reduce(`, date fields, approved/non-rejected status checks, date-only Date construction, and numeric `||` fallbacks. Searches covered source, tests, scripts and migrations; ignored `HR Console.dc.html`. Remaining `SUM(days_count)` occurs in the intentionally preserved historical/baseline SQL, replaced by the new migration. Remaining `|| 0` attendance defaults preserve a numeric zero; no fallback to a different stored number remains in Time Tracking. Raw punch spans, anomaly checks, individual ledger values and request records describe stored activity rather than being independent monthly attendance totals.

**8. Remaining limits / decisions / technical debt**

- User decision: approved standalone `on_leave/vacation/sick_leave` entries count as leave, never hours, and never suppress other regular attendance. Manual entry forms and demo seeds support an independent source; production row provenance (manual vs legacy/generated) is not conclusively known. Unioned dates prevent double-counting requests. Pending standalone rows are ignored.
- Half-day reason tags still cover whole weekdays. No public-holiday calendar exists. Existing attendance-rate denominator is 22. Existing stored hour columns round to one decimal; JS helpers retain up to two decimals. No unrelated precision/schema change was made.
- The two standalone-only historical employee/months are intentionally not backfilled. Their stored values can remain at the older interpretation until a later ordinary refresh. Current service calculations use the selected rule; a degraded stored-summary fallback can expose those stale historic values. Broadening this repair was explicitly avoided.
- READ COMMITTED approval/fill orderings are proven on two sessions and match the current production default. Other isolation levels, unusual multi-employee transactions and deadlock/serialization retry behavior are not exhaustively proven. Concurrent duplicate fills can produce a unique-constraint error while still preventing duplicates.
- Restore is a sequence of normal fill calls, not one atomic status+restore transaction. Partial failures are visible, and retries are idempotent. Concurrent edits during the client's OLD-range read still require normal conflict/retry handling; no versioning protocol was added.
- Portraits remain one complete batch; another browser's photo change may remain cached for up to five minutes. Memory holds one batch plus an in-flight request, cleared on auth/unmount or relevant mutations; TTL is not a periodic eviction timer. Existing linked-avatar/photo source precedence was preserved.
- Raw query pagination/API row caps are pre-existing debt. Production's largest observed monthly time-entry set was 289, leave request count 9, and largest monthly overtime-log set 1; this audit did not redesign large historical fetches or pagination.
- Individual report/Excel/PDF request rows continue to show full-request `days_count` and full start/end dates. For Sep30→Oct2 the request row can show 3 in an October export while canonical October leave is 2. That is full-request duration, but the generic “Days” label can be misread as a period subtotal. No clipped or fabricated request data was substituted.
- Browser interaction, actual Excel/PDF file rendering and a live login timing benchmark remain unverified. Roster/avatar ordering is verified by implementation and cache tests. Existing password-screen regressions and lint debt remain outside this repair.
- Production broad summary policies and older source approval guards remain as audited; changing them is the separate undeployed access-hardening work. This migration does not claim to secure those unrelated direct-write paths.

**9. Migration safety assessment: SAFE TO APPLY to the audited schema, as a standalone transaction**

This assessment is for the attendance SQL file, not a blind `supabase db push` or a claim that the full UI release is verified. Evidence goes beyond successful execution: exact production function/ACL/policy/trigger catalogs were captured and replayed; production stays INVOKER; the alternate existing definer boundary is preserved rather than invented; scope checks were attacked through real SQL roles; trigger paths were exercised after INSERT/UPDATE/DELETE; target periods and exact deletion near misses were verified against stored rows; unrelated history was compared byte-for-byte; accidental replay was checked; and both approval/fill transaction orderings were tested at the observed production isolation level.

Apply the attendance migration before deploying its updated client, using the verified owner and one transaction. Recheck the catalog if the target schema changes. The baseline and separate access migration have their own deployment/history prerequisites described in `supabase/README.md`. No migration has been applied to production by this takeover.


**10. Authorized follow-up — errors and concrete limitations repaired**

- Both password-recovery tests now execute successfully. Their explicit local loader recognizes the reset screen's added visual modules while continuing to use the actual installed Supabase SDK, auth provider, and reset component. No recovery assertions were removed.
- `AuthProvider` moved to `src/contexts/AuthProvider.jsx`; `AuthContext.jsx` now contains only the shared context and `useAuth`. `main.jsx` and the two provider-test loaders use the new provider path. This fixes the React Refresh error without disabling the rule or changing authentication behavior. The in-memory application module graph resolves successfully.
- PDF cleanup uses the equivalent Unicode control-character class instead of invalid linted control-code regex ranges. Both reported regex errors are fixed.
- Individual and organization summary services no longer return old stored totals or fabricated successful zeros when a source fails. Time Tracking, Dashboard, and Reports surface load errors. Reports also stop an export if approved-leave data cannot be loaded. Standalone-only historical database rows remain intentionally untouched, but are no longer used by the app as a degraded fallback.
- `fetchAllRows` reads all attendance-source pages with deterministic ordering and exact counts, including a server cap smaller than the requested page size. It rejects page failures and changing result counts instead of presenting partial totals. Time-entry/leave/overtime service reads, fill eligibility reads, and both report preview/export queries use it. This follows [Supabase's documented response cap and range pagination](https://supabase.com/docs/reference/javascript/select). Unrelated task/goal/roster query pagination is outside this attendance change.
- Leave writes compare employee, start/end date, status, leave type and reason against the snapshot read before UPDATE. Edit/revert dialogs also supply their displayed snapshot. A changed row returns `LEAVE_CONFLICT` without restoring the stale range. SQL nulls use `IS NULL`; no timestamp-column freshness assumption is made.
- A partial restoration returns the exact released weekdays. Leave Management retains a queue and an explicit retry button; retry invokes the same standard-fill helper, respects current leave/manual attendance, and is idempotent. The queue lasts for that mounted screen; normal Fill Standard Hours remains the recovery option after navigation/reload. Status and restoration remain separate transactions, deliberately not a new privileged RPC.
- Standard fill now retries at most twice after unique/serialization/deadlock failure, rereading eligibility each time. Ordinary bulk inserts keep their existing behavior. Employee IDs are deduplicated before validation.
- Request rows in the report screen, CSV/Excel, and PDF say **Request days (full range)**; canonical period totals still count clipped distinct weekdays. All supported locale additions contain the new labels and retry/conflict messages.
- Portrait cache mutations notify mounted consumers and other tabs of the same origin without sending photo data through storage. Changed/deleted photos replace existing roster portraits. Cache expiry releases its reference after five minutes; listeners/timers are removed on unsubscribe/cache clear. Deferred roster/portrait ordering remains. Separate browsers/devices still use the five-minute cache policy; no realtime/storage redesign was introduced.
- The migration drops only its own temporary backfill table after use. Two copies in the same transaction are now tested and supported, as are separate-transaction replays. Security attributes, ACLs, policies, target employee/months and DELETE predicate are unchanged.

New/updated follow-up coverage:

| Behavior | Test |
| --- | --- |
| Recovery with actual SDK/provider/screen | Both previously failing cases in `passwordRecoverySession.test.js`; 9 recovery/error tests pass together |
| Failed source cannot return stale/zero success | `failed source reads never return old stored summaries or fabricated successful zeros` |
| More than 1,000 records / lower server cap | `attendance sources load past the server row cap for individuals overview and report ledgers` |
| Real SDK range/count semantics and page failures | Both `tests/fetchAllRows.test.js` cases |
| Concurrent range edit / stale modal / nullable status | Two new service conflict tests |
| Partial restoration retry, original released range, repeat safety | `explicit restoration retry retains released dates after the status change and is idempotent` |
| Concurrent duplicate fill | `a competing standard fill is reread after unique violation without duplicating its row` |
| Photo expiry, local notifications, cross-tab invalidation, lifecycle cleanup | Fourth `employeePhotoCache.test.js` case |
| Same-transaction migration replay | `runAttendanceCases` now executes two copies inside one transaction on both schema states and compares source rows and summary values |

Final commands/results:

- `npm test`: **229 passed, 0 failed**, exit 0.
- `TZ=America/Los_Angeles node --test tests/attendanceRules.test.js tests/auditServiceRegressions.test.js tests/reportExportHelpers.test.js tests/employeePhotoCache.test.js tests/fetchAllRows.test.js`: **70 passed, 0 failed**, exit 0.
- `node scripts/test-hr-database.mjs`: **175 assertions/cases passed**, plus **four** replay comparisons, exit 0. Initial sandbox attempt was blocked by Docker-socket permissions; the approved local-only rerun passed.
- Touched-file ESLint command below: **0 errors, 14 existing hook-dependency warnings**, exit 0. Warnings are not described as a clean warning-free run.
- `git diff --check`: exit 0.
- Browser reconnect/discovery: no browser available, empty list. Interactive UI, rendered export files and live login timings remain unverified. An esbuild in-memory module-graph check verifies imports/exports only, not browser behavior.

```sh
./node_modules/.bin/eslint scripts/test-hr-database.mjs src/App.jsx src/components/AdminTimeEntry.jsx src/components/ResetPassword.jsx src/components/controlPanel.jsx src/components/dashboard.jsx src/components/deleteEmployeeManager.jsx src/components/employeeDirectory.jsx src/components/leaveManagement.jsx src/components/reports.jsx src/components/timeClockEntry.jsx src/components/timeTracking.jsx src/components/userEmployeeCard.jsx src/components/workDaysModal.jsx src/contexts/AuthContext.jsx src/services/employeeService.js src/services/timeTrackingService.js src/translations/additions/de.js src/translations/additions/en.js src/translations/additions/es.js src/translations/additions/fr.js src/translations/additions/jp.js src/translations/additions/kr.js src/translations/additions/ru.js src/translations/additions/th.js src/translations/additions/vn.js src/translations/en.js src/utils/attendanceRules.js src/utils/reportExportHelpers.js tests/attendanceRules.test.js tests/auditServiceRegressions.test.js tests/employeePhotoCache.test.js tests/helpers/queryFixture.js tests/reportExportHelpers.test.js src/contexts/AuthProvider.jsx src/main.jsx src/utils/fetchAllRows.js tests/fetchAllRows.test.js tests/passwordRecoverySession.test.js tests/passwordResetErrors.test.js
```

Follow-up file changes are the auth provider/context and main entry; App; Dashboard,
Time Tracking, Leave Management, Reports, controlPanel and userEmployeeCard;
employee/time-tracking services; `fetchAllRows.js`; all nine locale additions;
attendance migration and DB runner; query fixture, recovery tests, attendance
service tests, photo-cache tests and `fetchAllRows.test.js`; README and this audit.
No dependencies were added, no production changes were applied, and no commit or
push was performed.

**Current migration assessment remains SAFE TO APPLY to the audited schema as
one standalone owner-run transaction, before deploying the changed client.**
Both schema states and both READ COMMITTED approval/fill orderings still pass.
Pre-existing broad production policies are preserved as the original requirements
instructed; changing them remains separate access-hardening work. Half-day policy,
absence of a holiday calendar and historical backfill scope are unchanged business
constraints. Multi-request reads/restoration are not a single database snapshot;
other isolation levels and every possible multi-employee deadlock are not claimed
exhaustively verified.
