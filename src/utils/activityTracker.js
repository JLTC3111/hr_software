/**
 * Shared last-activity timestamp for idle logout and session keep-alive.
 * One source of truth avoids keep-alive refreshing JWTs while the user is idle.
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

let lastActivityAt = Date.now();
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

/** Record user activity (throttled). */
export const markActivity = (() => {
  let throttleUntil = 0;
  return () => {
    const now = Date.now();
    if (now < throttleUntil) return;
    throttleUntil = now + 1000;
    lastActivityAt = now;
    notify();
  };
})();

export const getLastActivityAt = () => lastActivityAt;

export const getIdleDurationMs = () => Date.now() - lastActivityAt;

export const isRecentlyActive = (withinMs) => getIdleDurationMs() < withinMs;

export const subscribeActivity = (callback) => {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
};

/** Attach global listeners once (idempotent). */
export const ensureActivityListeners = () => {
  if (listenersAttached || typeof document === 'undefined') return;
  listenersAttached = true;
  const opts = { passive: true, capture: true };
  ACTIVITY_EVENTS.forEach((evt) => {
    globalThis.addEventListener(evt, markActivity, opts);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      markActivity();
    }
  });
};

export const resetActivity = () => {
  lastActivityAt = Date.now();
  notify();
};

export { ACTIVITY_EVENTS };
