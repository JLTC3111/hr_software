# Password recovery

HR submits recovery requests to `hr-password-recovery`. That Edge Function
validates the email format and calls the service-only
`public.password_recovery_email(text)` RPC. The RPC checks the exact normalized
email in Supabase `auth.users`, which is the source of truth. HR employee profiles,
email aliases without an Auth account, and Contract profile rows cannot authorize
a recovery email.

Invalid addresses and addresses without an eligible Auth account stop before
email delivery. Deleted, banned, anonymous, and SSO-only accounts are excluded.
An existing email does not need a new confirmation step. Address format and an
Auth record do not prove a mailbox is currently deliverable.

For a matching account, the function passes its stored email to Supabase Auth's
native recovery endpoint, preserving the existing templates and send limits.
HR always uses `https://hr.icue.vn/reset-password` as the callback. The caller
cannot replace the recipient or callback. Neither the function nor the client
automatically retries email delivery.

The lookup RPC grants execution only to `service_role`; `anon`, `authenticated`,
and `PUBLIC` have no execution permission. The service key stays in the Edge
Function environment. The function accepts an anonymous-key JWT so signed-out
users can request recovery, and returns only safe status codes to the client.

Previously, the client treated Supabase's HTTP 200 response as proof that an
email had been sent. Native Auth intentionally returns the same empty success
response for an unknown email. The new client displays success only after the
server's registered-account check and native recovery request both succeed.
An unknown address receives the translated no-account notice.

HR and Contract share one Supabase project. Apply
`migrations/20261106164826_enforce_registered_password_recovery.sql` once to that
project, deploy `hr-password-recovery` and `contract-password-recovery` with their
shared modules, then release the updated clients. The same migration is tracked
in both repositories; do not apply the older HR baseline to the existing project.

Run `npm test` for the HR regressions. Focused checks are:

```sh
node --test tests/passwordRecoveryRequest.test.js tests/passwordRecoveryHandler.test.js tests/passwordResetErrors.test.js tests/passwordRecoverySession.test.js
```

The handler tests inject a local sender and verify that invalid or unknown
addresses never call Auth, while eligible emails use the stored address and fixed
callback. The client tests exercise the installed Supabase SDK, including HTTP
errors, unavailable services, rate limits, and the signed-out Edge request. These
tests send no real emails. Check database grants and eligibility predicates only
against a disposable test database:

```sh
psql --set=ON_ERROR_STOP=1 --dbname="$RECOVERY_TEST_DATABASE_URL" --file=supabase/tests/password_recovery.sql
```

The SQL suite creates fixture Auth records inside a transaction and rolls it
back. Its connection must point to an isolated database, never the production
project.
