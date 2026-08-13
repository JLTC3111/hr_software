/**
 * Shared last-activity timestamp for idle logout and session keep-alive.
 * One source of truth avoids keep-alive refreshing JWTs while the user is idle.
 *
 * The stamp is persisted, because an idle clock that only lives in memory can
 * only ever expire a tab that stayed open the whole time. Every reload, every
 * reopened tab, every machine woken from sleep started counting from zero while
 * the persisted token was restored as normal — so a session left idle for hours
 * was signed straight back in. Persisting it also makes the clock shared: being
 * active in one tab keeps the others alive instead of letting them expire and
 * wipe the storage underneath the tab actually in use.
 */

const ACTIVITY_EVENTS = [
  'click',
  'keydown',
  'mousedown',
  'touchstart',
  'scroll',
  'wheel',
  'pointerdown',
];

export const ACTIVITY_STORAGE_KEY = 'hr_app_last_activity';

/**
 * @returns {number|null} the persisted stamp, or null when there is none.
 *          Null is "unknown", not "idle for ever" — callers have to tell the
 *          difference, so it is never collapsed into a number here.
 */
const readPersisted = () => {
  try {
    const raw = globalThis.localStorage?.getItem(ACTIVITY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    // A stamp in the future is a clock change, not activity. Clamping keeps a
    // rolled-back system clock from granting an unbounded session.
    return Math.min(parsed, Date.now());
  } catch {
    return null;
  }
};

const writePersisted = (value) => {
  try {
    globalThis.localStorage?.setItem(ACTIVITY_STORAGE_KEY, String(value));
  } catch {
    // Private mode / quota. The in-memory clock still applies for this tab.
  }
};

let lastActivityAt = readPersisted() ?? Date.now();
let listenersAttached = false;
const subscribers = new Set();

const notify = () => {
  subscribers.forEach((fn) => {
    try {
      fn(lastActivityAt);
    } catch (err) {
      console.error('activityTracker subscriber error:', err);
    }
  });
};

const record = (now) => {
  lastActivityAt = now;
  writePersisted(now);
  notify();
};

/** Record user activity (throttled). */
export const markActivity = (() => {
  let throttleUntil = 0;
  return () => {
    const now = Date.now();
    if (now < throttleUntil) return;
    throttleUntil = now + 1000;
    record(now);
  };
})();

export const getLastActivityAt = () => {
  // Another tab may have been the active one; its stamp counts as activity here.
  const persisted = readPersisted();
  if (persisted !== null && persisted > lastActivityAt) {
    lastActivityAt = persisted;
  }
  return lastActivityAt;
};

export const getIdleDurationMs = () => Date.now() - getLastActivityAt();

export const isRecentlyActive = (withinMs) => getIdleDurationMs() < withinMs;

/**
 * Idle duration according to the persisted stamp alone, or null when nothing
 * has been persisted.
 *
 * The auth bootstrap needs this rather than getIdleDurationMs(): at that point
 * the in-memory clock has just been initialised to "now" if the store was
 * empty, which would report every cold start as freshly active.
 */
export const getPersistedIdleDurationMs = () => {
  const persisted = readPersisted();
  return persisted === null ? null : Date.now() - persisted;
};

export const subscribeActivity = (callback) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

/**
 * Attach global listeners once (idempotent).
 *
 * `visibilitychange` is deliberately not among them. It used to call
 * markActivity(), which meant that returning to a backgrounded tab was recorded
 * as user activity and reset the idle clock — and it reset it *before*
 * useIdleLogout's own visibility handler could read it, since that one is
 * registered later. A tab asleep for hours therefore measured ~0ms idle the
 * instant it woke, and the idle timeout could never fire on wake. Becoming
 * visible is not input; only the events below are.
 */
export const ensureActivityListeners = () => {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;
  const opts = { passive: true, capture: true };
  ACTIVITY_EVENTS.forEach((evt) => {
    globalThis.addEventListener(evt, markActivity, opts);
  });
};

export const resetActivity = () => {
  record(Date.now());
};

/**
 * Start the clock only if it is not already running.
 *
 * The difference from resetActivity() matters once the stamp is persisted. A
 * hook that unconditionally reset on mount would overwrite a real, still-valid
 * stamp with "now" every time it became enabled — and a tab the *browser*
 * reopened on startup mounts without anyone touching it, silently buying a
 * fresh idle window. Continuing the existing countdown is both more accurate
 * and the conservative direction.
 *
 * @returns {boolean} true when a new stamp was written.
 */
export const ensureActivityStamp = () => {
  if (readPersisted() !== null) return false;
  record(Date.now());
  return true;
};

/**
 * Forget the persisted stamp — called on sign-out, so the next session starts
 * with a clean clock rather than inheriting the previous user's.
 */
export const clearPersistedActivity = () => {
  try {
    globalThis.localStorage?.removeItem(ACTIVITY_STORAGE_KEY);
  } catch {
    // ignore
  }
  lastActivityAt = Date.now();
};

export { ACTIVITY_EVENTS };
