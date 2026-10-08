# HR audit repairs and attendance helper — 8 October 2026

All nine numbered findings in `/private/tmp/hr-codebase-audit.md` have local fixes. The hosted database and Edge Functions have not been changed. The reference asset is the first blue HR penguin from the supplied mascot style guide.

| Audit finding | Repair |
| --- | --- |
| Managers can expand their own scope | Managers cannot change their own placement or another privileged profile's placement. A subordinate's old and new placement must remain within their management scope. Administrators retain placement control. |
| Protected HR translations exposed to unrelated accounts | Translation reads require active HR membership and access to the original record through its existing RLS. All six supported source types are checked. |
| Goal discussions exposed or impersonated | Discussion reads and inserts require access to the parent goal. The database validates the stable HR author ID and derives the author name. |
| Inconsistent translation publishing | Publishing requires an active administrator through the central Auth-to-HR mapping. Managers, employees and inactive administrators cannot publish. |
| Punch-out rounds backward | Total minutes are rounded before deriving both the hour and minute; 17:59:45 becomes 18:00. |
| Complete lists silently truncated | Employee, task, review, goal, skills, feedback, summary, photo and open-punch list reads use exact-count pagination and stable ordering. Filters and report-period semantics are preserved. A failed later page reports failure. |
| Visit handler silently loses writes | The migration adds `anonymized_ip`; the handler returns HTTP 500 when insertion fails. |
| Deletion requires optional external tables | Only an error identifying an absent optional phase table is tolerated. Required-table, column, permissions and connection errors still stop deletion. |
| Deleting an assessor blocks employee deletion | `skills_assessments.assessed_by` uses `ON DELETE SET NULL`, preserving the colleague's assessment. |

Local security advisors also found the legacy globally writable `proof_file_audit` policy. Its reads now follow employee scope, inserts validate the operator, and authenticated callers cannot rewrite, delete or truncate history. Service-side privileges are retained. The translation loader now runs after authentication and clears confidential overrides when the reader changes or signs out.

The logged-in attendance helper appears on protected application pages for accounts linked to an employee. It uses a single button that changes from **Start lunch break** to **Resume work**. Lunch defaults to **12:00–13:00 in the browser's local time**; the return reminder appears from 13:00 while an earlier break is open. The reminder requires today's open punch. Users can open it manually or snooze it for ten minutes, including across reloads.

The modal blurs the background, blocks background interaction, traps keyboard focus, supports Escape to snooze, and restores focus when closed. Break actions retain the original punch-in and exclude the break from worked hours. The existing Punch Clock and the helper share one session. Reminder actions wait for a saved server response; failures leave the timer unchanged and offer retry. Polling preserves and retries unsaved local Punch Clock actions, and stale replies cannot overwrite a newer action or another account's session.

The shared artwork is at `public/mascot/hr-penguin.png`, with the generation prompt and built-in tool mode recorded in `public/mascot/README.md`. `HrMascot.jsx` is reusable for the future knowledge-base chatbot. No chatbot integration was added.

Validation completed:

- 312 application tests passed, including actual PDF/XLSX exports, capped-list pagination, Edge handler failures, rounding, break transitions, identity changes and offline-punch retry/ordering.
- The disposable PostgreSQL runner passed 77 existing access/workflow assertions, 46 new audit-repair assertions, both 47-assertion attendance schema paths, translation/comment and time-clock policy checks, replay checks, and four two-session attendance races.
- The new repair migration was replayed twice in one transaction, then its 46 behavior assertions passed again. Local Supabase security advisors at warning/error level reported no issues.
- Actual Chrome demo flow passed lunch start, keyboard focus/Escape, snooze and reload, return from lunch, and final punch-out. The saved example was 08:30–18:00, with 55 lunch minutes excluded and 8.6 hours filed as pending. Mobile English/light and Vietnamese/dark layouts had no horizontal overflow; signed-out screens hid the widget.
- A separate Chrome fixture using the real provider, service and modal intercepted all Supabase HTTP requests locally. HTTP 500 retained the running timer and showed retry; retry saved the break; resume retained the original punch; Escape/Tab remained safe during saving; a manual dialog did not follow a changed employee; unlinked and signed-out accounts hid the widget. No hosted writes occurred.
- Source lint has zero errors and 25 existing warnings. Generated desktop output and `HR Console.dc.html` are excluded. `git diff --check` is clean.

Existing dependencies were updated without adding a new direct dependency. jsPDF is 4.2.1, its AutoTable plugin 5.0.8, React Router 7.18.4 and Vite 7.3.7; compatible transitive security updates are locked, including a scoped ExcelJS UUID update. The existing Supabase, React and PDF.js versions were preserved to avoid unrelated behavior changes. The final npm scan reports zero critical/high/low entries and eight moderate package entries, all tracing to the desktop builder's `sprintf-js` proxy-logging chain. The [upstream advisory](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) remains unresolved in that chain; npm proposes downgrading Electron Builder from 26.15.3 to 26.5.0. That downgrade was not applied. The builder tools are excluded from the packaged renderer/runtime dependency tree by `electron-builder.cjs`.

Deployment requires applying `supabase/migrations/20261008045859_fix_audited_hr_permissions_and_schema.sql` after the existing migration chain, then deploying `record-visit` and `admin-delete-user` and the updated frontend. The permission repair should reach the database before frontend rollout. Check the hosted migration history first; local replay does not establish that project's schema state. Hosted-account, Storage HTTP and native-installer verification remains outside this local validation. No commit or push was made.
