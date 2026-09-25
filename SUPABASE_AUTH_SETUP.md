# HR password recovery

HR reset emails return to `https://hr.icue.vn/reset-password`.
Web builds use `VITE_APP_URL`, then `VITE_SITE_URL`, then the current website
origin. Desktop builds must configure `VITE_APP_URL=https://hr.icue.vn` so
emails open the hosted reset page instead of the desktop app's custom scheme.

## Shared Supabase settings

HR and Contract Manager share project `idkfmgdfzcsydrqnjcla`.
In [Authentication → URL Configuration](https://supabase.com/dashboard/project/idkfmgdfzcsydrqnjcla/auth/url-configuration):

- Keep the Site URL as `https://hr.icue.vn`.
- The existing `https://hr.icue.vn/**` Redirect URL permits the HR reset page.
- Preserve the contract app's allowed callbacks when editing this shared list.
- For a local web callback, allow that origin's exact `/reset-password` URL;
  alternatively set `VITE_APP_URL=https://hr.icue.vn` to finish on the website.

The Reset Password email template should link to `{{ .ConfirmationURL }}`.
It must preserve the per-request redirect instead of linking directly to the
shared Site URL.

## Email delivery

The built-in Supabase sender allows only two authentication emails per hour
for the shared project. HR and Contract Manager both use that allowance.
An `over_email_send_rate_limit` response means no reset email was sent; the HR
form displays an email sending limit message for this error.

The shared project now uses the ICUE mail service (configured 2026-09-25):

- SMTP host: `mail90172.maychuemail.com`.
- Port: `587` with STARTTLS; the certificate and mailbox login were verified.
- Username and sender address: `dev@icue.vn`; sender name: `ICUE`.
- Authentication email allowance: 30 per hour; per-user cooldown: 60 seconds.

SMTP credentials belong in Supabase's server configuration, outside the
frontend's `VITE_` variables. The local copy is in the gitignored `.env.local`
with owner-only permissions. Never commit credentials or include passwords
or recovery tokens in logs.

### Remaining SMTP timeout

The provider's initial greeting took about 11 seconds on both ports 587 and
465. STARTTLS and authentication brought the port 587 check to about 12 seconds.
The project's Auth request limit is 10 seconds. A request to raise
`api_max_request_duration` to 30 was rejected because this setting requires
Supabase Pro or higher; the limit therefore remains 10 seconds.

The live recovery test delivered two messages for one request, with a 504
timeout followed by a successful retry in the Auth logs. Both email links
correctly target `https://hr.icue.vn/reset-password`. Delivery is verified,
but timeout-free sending still needs a faster SMTP greeting from P.A. Việt Nam
or an approved Supabase plan change that permits a longer request duration.
Port 587 remains configured because port 465 did not remove the delay.

## Recovery behavior

`detectSessionInUrl: true` lets the Supabase SDK process recovery links before
the reset screen reads the session. JavaScript uses the implicit flow by default;
the flow type is a client option, not a dashboard URL setting. The reset route
is accessible whether or not the user was already signed in.

A matching recovery callback starts a fresh activity window before the normal
idle check runs. The SDK can emit `INITIAL_SESSION` before `PASSWORD_RECOVERY`;
applying a previous session's idle timestamp here would immediately sign out
the newly verified session. Ordinary stored sessions still obey the idle limit.

An invalid or expired link cannot establish a recovery session. Request a new
email instead of reusing a consumed link. After changing redirect settings,
request a fresh email because previously sent links retain their destination.

## Verification

Run `node --test tests/passwordReset.test.js tests/routes.test.js tests/desktopPolicy.test.js`.
Run `node --test tests/passwordRecoverySession.test.js` to exercise recovery
startup, stale idle activity, and expired links with the real provider, reset
screen, and installed SDK using simulated HTTP responses.
The reset request check uses the installed SDK with simulated HTTP responses
and does not send an email. On the live site, check that the Supabase callback
stays on `/reset-password` and that a direct request to the route returns the app.

References: [Supabase password recovery](https://supabase.com/docs/guides/auth/passwords#resetting-a-password),
[redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls),
[email rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
