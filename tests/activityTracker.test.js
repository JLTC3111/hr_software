import test from 'node:test';
import assert from 'node:assert/strict';

/*
 * This module decides how long a user has been idle, and that number is what
 * stands between an idle session and being silently signed back in. Both ways
 * of getting it wrong shipped at once: the clock lived only in memory, so every
 * reload reported a fresh start, and becoming visible was recorded as activity,
 * so waking a tab reset it too. The cases below pin down both.
 *
 * The module reads storage at import time, so each test installs its stubs and
 * then imports a fresh copy via a cache-busting query string.
 */

const makeStorage = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    get size() {
      return map.size;
    },
  };
};

let importCounter = 0;
const loadTracker = async ({ storage, document: doc, addEventListener } = {}) => {
  globalThis.localStorage = storage ?? makeStorage();
  if (doc !== undefined) globalThis.document = doc;
  if (addEventListener !== undefined) globalThis.addEventListener = addEventListener;
  importCounter += 1;
  return import(`../src/utils/activityTracker.js?t=${importCounter}`);
};

const KEY = 'hr_app_last_activity';

test('a stamp from before the idle window reports the real elapsed time', async () => {
  // The reopened-tab case: nothing ran for 40 minutes, and the clock has to say so.
  const fortyMinutesAgo = Date.now() - 40 * 60 * 1000;
  const storage = makeStorage({ [KEY]: String(fortyMinutesAgo) });
  const { getIdleDurationMs, getPersistedIdleDurationMs, isRecentlyActive } = await loadTracker({ storage });

  assert.ok(getIdleDurationMs() >= 40 * 60 * 1000);
  assert.ok(getPersistedIdleDurationMs() >= 40 * 60 * 1000);
  assert.equal(isRecentlyActive(15 * 60 * 1000), false);
});

test('no stored stamp is unknown, not idle', async () => {
  // The auth bootstrap must be able to tell "cleared store" from "away for ever",
  // or the first load after this shipped signs everyone out.
  const { getPersistedIdleDurationMs, getIdleDurationMs } = await loadTracker({ storage: makeStorage() });

  assert.equal(getPersistedIdleDurationMs(), null);
  // The in-memory clock still starts now, so the live rule stays permissive.
  assert.ok(getIdleDurationMs() < 1000);
});

test('activity is persisted so it survives a reload', async () => {
  const storage = makeStorage();
  const { markActivity } = await loadTracker({ storage });

  markActivity();
  assert.ok(Number(storage.getItem(KEY)) > 0);

  // A second import stands in for the next page load.
  const { getIdleDurationMs } = await loadTracker({ storage });
  assert.ok(getIdleDurationMs() < 1000);
});

test('a newer stamp from another tab counts as activity here', async () => {
  const storage = makeStorage({ [KEY]: String(Date.now() - 20 * 60 * 1000) });
  const { getIdleDurationMs } = await loadTracker({ storage });

  assert.ok(getIdleDurationMs() >= 20 * 60 * 1000);

  // The user is working in the other tab; this one must not expire underneath it.
  storage.setItem(KEY, String(Date.now()));
  assert.ok(getIdleDurationMs() < 1000);
});

test('a stamp in the future is clamped to now', async () => {
  // A rolled-back system clock would otherwise buy an unbounded session.
  const storage = makeStorage({ [KEY]: String(Date.now() + 60 * 60 * 1000) });
  const { getIdleDurationMs } = await loadTracker({ storage });

  assert.ok(getIdleDurationMs() >= 0);
  assert.ok(getIdleDurationMs() < 1000);
});

test('a corrupt stamp is treated as no stamp', async () => {
  const storage = makeStorage({ [KEY]: 'not-a-number' });
  const { getPersistedIdleDurationMs } = await loadTracker({ storage });

  assert.equal(getPersistedIdleDurationMs(), null);
});

test('clearing forgets the stored stamp', async () => {
  const storage = makeStorage({ [KEY]: String(Date.now() - 60 * 1000) });
  const { clearPersistedActivity, getPersistedIdleDurationMs } = await loadTracker({ storage });

  clearPersistedActivity();
  assert.equal(storage.getItem(KEY), null);
  assert.equal(getPersistedIdleDurationMs(), null);
});

test('a tab waking inside the window still counts as refreshable', async () => {
  /*
   * The guard on the thing visibilitychange -> markActivity was protecting.
   *
   * A suspended tab misses the keep-alive interval, so it can wake holding an
   * access token that expired while it slept. Repairing that depends on
   * isRecentlyActive() still being true, and useSessionKeepAlive is asked with
   * the same window the idle logout uses (SESSION_KEEPALIVE_ACTIVITY_MS ===
   * IDLE_LOGOUT_TIMEOUT). So there must be no gap between the two: no idle
   * duration may exist where the session is allowed to live but a refresh is
   * refused, or the stale token comes straight back.
   */
  const IDLE_WINDOW = 15 * 60 * 1000;
  const storage = makeStorage({ [KEY]: String(Date.now() - 14 * 60 * 1000) });
  const { isRecentlyActive, getIdleDurationMs } = await loadTracker({ storage });

  // Asleep for 14 minutes: still inside the window, so the session lives...
  assert.ok(getIdleDurationMs() < IDLE_WINDOW);
  // ...and the keep-alive must therefore still be willing to renew the token.
  assert.equal(isRecentlyActive(IDLE_WINDOW), true);
});

test('the clock is adopted, not restarted, when one is already running', async () => {
  // A tab the browser reopened on startup mounts the idle hook with nobody
  // touching it; restarting the clock there would hand out a free idle window.
  const twelveMinutesAgo = Date.now() - 12 * 60 * 1000;
  const storage = makeStorage({ [KEY]: String(twelveMinutesAgo) });
  const { ensureActivityStamp, getIdleDurationMs } = await loadTracker({ storage });

  assert.equal(ensureActivityStamp(), false);
  assert.ok(getIdleDurationMs() >= 12 * 60 * 1000);

  // With nothing stored there is a countdown to start, and it starts.
  storage.removeItem(KEY);
  const fresh = await loadTracker({ storage: makeStorage() });
  assert.equal(fresh.ensureActivityStamp(), true);
  assert.ok(fresh.getIdleDurationMs() < 1000);
});

test('becoming visible is not registered as user activity', async () => {
  /*
   * The regression that made idle logout unfireable on wake. The tracker's
   * visibilitychange handler reset the clock, and it ran before useIdleLogout's
   * own visibility check, so a tab asleep for hours measured ~0ms idle the
   * instant it came back.
   */
  const registered = [];
  const { ensureActivityListeners } = await loadTracker({
    storage: makeStorage(),
    document: { addEventListener: (evt) => registered.push(`document:${evt}`) },
    addEventListener: (evt) => registered.push(evt),
  });

  ensureActivityListeners();

  assert.ok(!registered.some((evt) => evt.includes('visibilitychange')));
  assert.ok(registered.includes('click'));
  assert.ok(registered.includes('keydown'));
});
