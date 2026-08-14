import { lazy } from 'react';

/**
 * React.lazy that survives a chunk that will not load.
 *
 * Every screen below the shell is code-split, so switching pages *is* a network
 * request for a JavaScript chunk. Two things routinely make that request fail
 * after a tab has been sitting idle:
 *
 *   1. A deploy happened while the tab was open. Vite fingerprints every chunk
 *      and Vercel only serves the current deployment's files, so the URLs this
 *      tab is holding no longer exist — they 404. index.html is served
 *      no-cache, so a reload fixes it permanently; nothing else does.
 *   2. A request for a hashed file 404'd once (deploy race, blip). Browsers
 *      cache that miss. A private window then works because it has no cache,
 *      while this profile keeps failing until the miss is replaced.
 *
 * Either way the import rejects, and React.lazy *caches the rejection*: the
 * component throws on that render and on every render after it, so the route is
 * dead for the rest of the session. With the app's only error boundary at the
 * root, that error unmounted the entire application — the "logged in fine, then
 * the app crashed as soon as I opened another page" report.
 *
 * So: retry the import a couple of times for transient misses, revalidate the
 * failed URL so a cached 404 can become a 200, then reload once. The reload is
 * guarded by a timestamp in sessionStorage so a genuinely broken build cannot
 * put the tab in a loop.
 */

const RELOAD_STAMP_KEY = 'hr_app_chunk_reload_at';

/** Long enough that a reload which did not help is not tried again. */
const RELOAD_COOLDOWN_MS = 30000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A failed dynamic import, as opposed to an error thrown by the module itself
 * while it was evaluating. Browsers word this differently, hence the list.
 */
export const isChunkLoadError = (error) => {
  const message = `${error?.message || error || ''}`.toLowerCase();
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('unable to preload css') ||
    message.includes('chunkloaderror') ||
    error?.name === 'ChunkLoadError'
  );
};

/** Same-origin JS/CSS URL named in a chunk-load error, if any. */
export const chunkAssetUrlFromError = (error, origin = globalThis.location?.origin) => {
  const message = `${error?.message || error || ''}`;
  const match = message.match(/https?:\/\/[^\s)'"]+/i);
  if (!match || !origin) return null;

  try {
    const url = new URL(match[0].replace(/[.,;]+$/, ''));
    if (url.origin !== origin) return null;
    if (!/\.(?:m?js|css)$/i.test(url.pathname)) return null;
    return url.href;
  } catch {
    return null;
  }
};

/**
 * Replace a cached miss for the failed file. `location.reload()` will not do
 * this on its own when the miss was stored as immutable.
 */
export const revalidateChunkCache = async (
  error,
  fetcher = globalThis.fetch,
  origin = globalThis.location?.origin,
) => {
  const url = chunkAssetUrlFromError(error, origin);
  if (!url || typeof fetcher !== 'function') return false;

  try {
    const response = await fetcher(url, {
      cache: 'reload',
      credentials: 'same-origin',
      mode: 'cors',
    });
    if (response?.ok === false) return false;

    // A SPA fallback can answer a missing .js URL with index.html and status
    // 200. Treating that as a repair only repeats the same failed import.
    const contentType = response?.headers?.get?.('content-type')?.toLowerCase();
    if (contentType) {
      if (/\.m?js$/i.test(url) && !/javascript|ecmascript/.test(contentType)) {
        return false;
      }
      if (/\.css$/i.test(url) && !contentType.includes('text/css')) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

/** One reload per cooldown window, across every route. */
const tryReloadOnce = () => {
  if (typeof window === 'undefined') return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY) || 0);
    if (Number.isFinite(last) && Date.now() - last < RELOAD_COOLDOWN_MS) {
      return false;
    }
    sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
  } catch {
    // Private mode with storage disabled: reloading blind is still better than
    // leaving the user on a route that can never render.
  }
  globalThis.location.reload();
  return true;
};

/** Revalidate a cached miss, then reload. `force` skips the cooldown (Reload button). */
export const recoverStaleChunk = async (error, { force = false } = {}) => {
  await revalidateChunkCache(error);
  if (force) {
    try {
      sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    globalThis.location.reload();
    return true;
  }
  return tryReloadOnce();
};

/**
 * @param {() => Promise<{default: import('react').ComponentType}>} factory
 * @param {{retries?: number, retryDelayMs?: number}} [options]
 */
export const lazyWithRetry = (factory, { retries = 2, retryDelayMs = 400 } = {}) =>
  lazy(async () => {
    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;

        // A module that throws while evaluating is a real bug in that screen;
        // retrying it just delays the error boundary.
        if (!isChunkLoadError(error)) throw error;

        if (attempt < retries) {
          await delay(retryDelayMs * (attempt + 1));
        }
      }
    }

    console.error('Route chunk failed to load; reloading to pick up the current build', lastError);

    if (await recoverStaleChunk(lastError)) {
      // The reload is already in flight. Never settling keeps the route in its
      // Suspense fallback instead of flashing an error the user cannot act on.
      return new Promise(() => {});
    }

    throw lastError;
  });

export default lazyWithRetry;
