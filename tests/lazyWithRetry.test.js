import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isChunkLoadError,
  chunkAssetUrlFromError,
  revalidateChunkCache,
} from '../src/utils/lazyWithRetry.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const ORIGIN = 'https://hr.icue.vn';
const CHUNK = `${ORIGIN}/assets/timeClockEntry-FRbUrLkF.js`;

test('Chrome chunk-load wording is a chunk error', () => {
  assert.equal(
    isChunkLoadError(new TypeError(`Failed to fetch dynamically imported module: ${CHUNK}`)),
    true
  );
});

test('a screen that threw while evaluating is not a chunk error', () => {
  assert.equal(isChunkLoadError(new TypeError('e is not a function')), false);
});

test('the failed module URL is taken only when it is our JS or CSS', () => {
  assert.equal(
    chunkAssetUrlFromError(
      new TypeError(`Failed to fetch dynamically imported module: ${CHUNK}`),
      ORIGIN
    ),
    CHUNK
  );
  assert.equal(
    chunkAssetUrlFromError(
      new TypeError(`Failed to fetch dynamically imported module: ${ORIGIN}/assets/app.css`),
      ORIGIN
    ),
    `${ORIGIN}/assets/app.css`
  );
  assert.equal(
    chunkAssetUrlFromError(
      new TypeError(`Failed to fetch dynamically imported module: https://evil.example/assets/x.js`),
      ORIGIN
    ),
    null
  );
  assert.equal(
    chunkAssetUrlFromError(
      new TypeError(`Failed to fetch dynamically imported module: ${ORIGIN}/login`),
      ORIGIN
    ),
    null
  );
});

test('a cached miss is revalidated with cache reload', async () => {
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
  };

  assert.equal(
    await revalidateChunkCache(
      new TypeError(`Failed to fetch dynamically imported module: ${CHUNK}`),
      fetcher,
      ORIGIN
    ),
    true
  );
  assert.deepEqual(calls, [
    {
      url: CHUNK,
      options: { cache: 'reload', credentials: 'same-origin', mode: 'cors' },
    },
  ]);
});

test('foreign URLs in an error message are not fetched', async () => {
  let fetched = false;
  await revalidateChunkCache(
    new TypeError('Failed to fetch dynamically imported module: https://evil.example/x.js'),
    async () => {
      fetched = true;
    },
    ORIGIN
  );
  assert.equal(fetched, false);
});

test('a missing chunk is not reported as recovered', async () => {
  assert.equal(
    await revalidateChunkCache(
      new TypeError(`Failed to fetch dynamically imported module: ${CHUNK}`),
      async () => ({ ok: false }),
      ORIGIN
    ),
    false
  );
});

test('an HTML SPA fallback is not reported as a recovered JS chunk', async () => {
  assert.equal(
    await revalidateChunkCache(
      new TypeError(`Failed to fetch dynamically imported module: ${CHUNK}`),
      async () => ({
        ok: true,
        headers: { get: () => 'text/html; charset=utf-8' },
      }),
      ORIGIN
    ),
    false
  );
});

/* ------------------------------------------------------------------ *
 * The login screen's decoration must stay optional
 * ------------------------------------------------------------------ *
 * The background is the heaviest thing on the login route and the only part of
 * it that can 404 after a deploy. Loading it with React.lazy caches the
 * rejection and escalates to the nearest error boundary, which takes the
 * sign-in form down with it — the "left the tab open, came back, could not log
 * in" report. These guard the shape that fixed it.
 */

test('the login background is loaded optionally, never through React.lazy', () => {
  const login = source('src/components/login.jsx');

  assert.match(login, /import OptionalLazy from '\.\/OptionalLazy\.jsx'/);
  assert.match(login, /<OptionalLazy\b/);
  assert.match(login, /load=\{loadLoginLaserBackground\}/);

  // React.lazy caches rejections forever; Suspense alone cannot catch one.
  assert.doesNotMatch(login, /\blazy\(/);
  assert.doesNotMatch(login, /<Suspense\b/);
});

test('the login screen still renders a background', () => {
  const login = source('src/components/login.jsx');

  assert.match(login, /const loadLoginLaserBackground = \(\) => import\('\.\/LoginLaserBackground'\)/);
  assert.match(login, /getLoginLaserTheme/);
  // Reduced motion drops the animated layer; the static grid carries the page.
  assert.match(login, /showLaserFlow && \(/);
});

test('OptionalLazy stays offline-safe and only retries on a confirmed recovery', () => {
  const optionalLazy = source('src/components/OptionalLazy.jsx');

  // No request at all while offline, and no second identical import unless the
  // asset was actually revalidated back into existence.
  assert.match(optionalLazy, /!isOnline\(\)/);
  assert.match(optionalLazy, /const recovered = await revalidateChunkCache\(error\)/);
  assert.match(optionalLazy, /if \(!recovered\) throw error/);

  // Recovery signals, so a tab that failed while offline heals on return.
  for (const event of ['online', 'focus', 'visibilitychange']) {
    assert.match(optionalLazy, new RegExp(`addEventListener\\('${event}'`), event);
  }

  // A failure is reported, never rethrown into the tree.
  assert.match(optionalLazy, /console\.warn/);
});

test('a failed decoration is contained by its own boundary', () => {
  const optionalLazy = source('src/components/OptionalLazy.jsx');
  assert.match(optionalLazy, /<OptionalChunkBoundary\b/);

  const boundary = source('src/components/OptionalChunkBoundary.jsx');
  assert.match(boundary, /getDerivedStateFromError/);
});
