import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isChunkLoadError,
  chunkAssetUrlFromError,
  revalidateChunkCache,
} from '../src/utils/lazyWithRetry.js';

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
