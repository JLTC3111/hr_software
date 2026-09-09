# ICUE HR Manager desktop

The desktop apps bundle the existing React interface with Electron 44.2.0. Windows
and macOS use the same Chromium runtime. Supabase remains the shared backend;
sign-in, synchronization, uploads and live HR records require internet access.
There is no offline write queue or automatic updater in this first version.

## Run and package

Use Node.js 22.12 or newer and `npm ci`. Copy the public configuration fields from
`.env.example` into your existing `.env` without replacing its other settings:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
VITE_APP_URL=https://hr.icue.vn
```

The build rejects missing values, non-HTTPS URLs and privileged API keys. The
public anon/publishable key is intentionally compiled into the interface, just
as on the website. Authorization continues to depend on Supabase policies.

| Command | Result |
| --- | --- |
| `npm run desktop:prepare` | Compile UI, bundle fonts, stage packaging input |
| `npm run desktop:start` | Open the prepared desktop UI locally |
| `npm run desktop:smoke` | Exercise the native runtime in a temporary profile |
| `npm run desktop:pack` | Test and produce an unpacked app for this computer |
| `npm run build:mac` | Test and produce Apple Silicon and Intel DMG/ZIP installers |
| `npm run build:win` | Test and produce a Windows x64 NSIS installer |

Installers are written to `artifacts/desktop/`. Build and validate macOS on a Mac
and Windows on Windows. A cross-built Windows installer still needs Windows
installation and runtime testing. The optional manual GitHub workflow performs
the commands on both operating systems. Configure repository variable
`VITE_SUPABASE_URL` and secret `VITE_SUPABASE_ANON_KEY` before running it.

The web development workflow (`npm run dev`) remains available. Re-run
`desktop:prepare` after changing UI or desktop source; `desktop:start` does not
start a development server or rebuild the UI.

## Runtime behavior

The private `hr-app://app` origin serves bundled files and SPA routes. It keeps
existing absolute asset paths, BrowserRouter history, localStorage and IndexedDB
working without a local web server. Renderer windows have sandboxing and context
isolation enabled, with no Node integration or native API bridge. Paths cannot
escape the bundled interface; file URLs, unexpected protocols and privileged
permissions are blocked.

HTTPS links open in the default browser, and email/phone links use the configured
OS app. App-origin Blob document previews stay in sandboxed windows. Exports use
the native Save dialog, including overwrite confirmation. Notification delivery
still depends on the user's in-app preference and OS notification settings.

Password-reset emails open the existing HTTPS website, where the user changes
their password before returning to the desktop sign-in screen. The website reset
URL must remain allowlisted in Supabase. The visible sign-in screen uses email and
password; the unused GitHub OAuth function has not been adapted for desktop deep
links. Do not expose it without implementing and testing a desktop callback flow.

Sessions are separate from browser sessions. The first desktop launch requires
sign-in. Remember Me uses the existing browser-storage implementation in the OS
user profile; this version does not add Keychain/Credential Manager token storage.
Closing all windows quits on Windows; macOS keeps the app available in the Dock.
Launching it again focuses the existing window. Uninstall preserves app data.

## Verification and distribution

Initial verification (September 9, 2026): all 139 unit tests passed. Apple Silicon
and Intel Mac DMG/ZIP files and a Windows x64 EXE installer were produced. Archive
inspection passed for all three targets. The packaged Apple Silicon app and Intel
app (via Rosetta) passed native smoke checks; their sign-in screens were visually
inspected. Windows was cross-built on macOS and has not been run on Windows. The
manual CI workflow is prepared but has not been run. These installers are unsigned
previews; real-account sign-in, write workflows and release signing remain to be
validated before employee rollout.

Packaging commands run the complete unit suite and native smoke checks first.
Smoke checks block external HTTP/WebSocket requests, use a fresh temporary
profile, and never sign in or mutate live HR records. They cover startup while
offline, protected route reload, browser storage, renderer isolation, bundled
fonts, PDF worker startup, data URL fetch, blocked paths/methods and Blob export.
They also save `artifacts/desktop-smoke.png`. They exercise the native Electron
runtime against the production frontend; they are not a substitute for installing
and testing the finished installer on each supported machine.

The packager also inspects every ASAR archive and rejects unexpected top-level
files, environment files or stale desktop source. The packaged executable accepts
`--desktop-smoke` to repeat native checks against the actual bundle in a temporary
profile; its screenshot path is printed in the terminal. This does not use the
normal app session or connect to Supabase.

Before employee distribution, validate on Windows and both Mac architectures:

- Install, launch, close, reopen, upgrade, uninstall and reinstall.
- Sign in/out and Remember Me; password-reset email round trip; idle logout;
  reconnect after network loss and waking from sleep.
- Employee/profile updates, permissions, punch clock, leave approvals,
  recruitment and performance workflows with dedicated test records.
- PDF upload/preview and PDF/CSV/XLSX exports, including Vietnamese, Japanese,
  Korean, Russian and Thai; native notifications and external links.

Local and CI outputs are previews until release credentials are configured.
macOS employee distribution needs Developer ID signing and Apple notarization;
Windows distribution needs your organization's code-signing setup. Keep signing
credentials in local/CI secrets. Electron Builder supports these via its normal
environment settings; do not commit certificate files or passwords. See
[Electron signing guidance](https://www.electronjs.org/docs/latest/tutorial/code-signing)
and [Electron Builder v26 signing configuration](https://www.electron.build/v26/docs/features/code-signing/).

The initial dependency audit found 24 existing package advisories (13 in the npm
production tree). Electron and its packager introduced no new reported findings.
The two critical entries involve the existing jsPDF/AutoTable chain; the specific
critical Node file-loading and new-window output paths are not used by this app's
browser `doc.save()` exports. This is a reachability assessment, not a clean audit.
Resolve or formally review the existing findings before broad distribution;
jsPDF remediation requires a separately verified major upgrade. Do not run
`npm audit fix --force`: it proposes an incompatible ExcelJS downgrade.

Reference: [Electron security recommendations](https://www.electronjs.org/docs/latest/tutorial/security),
[standard custom protocols](https://www.electronjs.org/docs/latest/api/protocol),
and [React-PDF worker configuration](https://github.com/wojtekmaj/react-pdf#configure-pdfjs-worker).
