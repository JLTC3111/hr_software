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

## Recovery behavior

`detectSessionInUrl: true` lets the Supabase SDK process recovery links before
the reset screen reads the session. JavaScript uses the implicit flow by default;
the flow type is a client option, not a dashboard URL setting. The reset route
is accessible whether or not the user was already signed in.

An invalid or expired link cannot establish a recovery session. Request a new
email instead of reusing a consumed link. After changing redirect settings,
request a fresh email because previously sent links retain their destination.

## Verification

Run `node --test tests/passwordReset.test.js tests/routes.test.js tests/desktopPolicy.test.js`.
The reset request check uses the installed SDK with simulated HTTP responses
and does not send an email. On the live site, check that the Supabase callback
stays on `/reset-password` and that a direct request to the route returns the app.

References: [Supabase password recovery](https://supabase.com/docs/guides/auth/passwords#resetting-a-password),
[redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).
