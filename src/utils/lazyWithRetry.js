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
 *   2. The machine slept, or the network moved, and the fetch failed while
 *      connectivity was still coming back.
 *
 * Either way the import rejects, and React.lazy *caches the rejection*: the
 * component throws on that render and on every render after it, so the route is
 * dead for the rest of the session. With the app's only error boundary at the
 * root, that error unmounted the entire application — the "logged in fine, then
 * the app crashed as soon as I opened another page" report.
 *
 * So: retry the import a couple of times for case 2, and for case 1 reload the
 * page once, since a reload is the only thing that can fix a stale chunk URL.
 * The reload is guarded by a timestamp in sessionStorage so a genuinely broken
 * build cannot put the tab in a loop.
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

    if (tryReloadOnce()) {
      // The reload is already in flight. Never settling keeps the route in its
      // Suspense fallback instead of flashing an error the user cannot act on.
      return new Promise(() => {});
    }

    throw lastError;
  });

export default lazyWithRetry;
