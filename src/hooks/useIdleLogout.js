import { useEffect, useMemo, useRef } from 'react';
import {
  ensureActivityListeners,
  ensureActivityStamp,
  getIdleDurationMs,
  subscribeActivity,
} from '../utils/activityTracker.js';

/** Never sleep shorter than this; a runaway loop helps nobody. */
const MIN_TICK_MS = 250;

/** While a countdown is on screen, look every second. */
const COUNTDOWN_TICK_MS = 1000;

/**
 * How long to sleep before looking at the idle clock again.
 *
 * Pure so the timing guarantees the countdown depends on can be tested without
 * a renderer: the warning appears with its full `warnBeforeMs` remaining rather
 * than up to one coarse interval late, and once it is showing the sign-out
 * lands within a second of the displayed zero.
 *
 * @param {number} idleForMs         how long the user has been idle
 * @param {object} bounds
 * @param {number} bounds.warnThreshold      idle duration at which the warning starts
 * @param {number} bounds.coarseIntervalMs   the lazy poll used before then
 * @returns {number} milliseconds to sleep
 */
export const idleTickDelay = (idleForMs, { warnThreshold, coarseIntervalMs }) => {
  if (idleForMs >= warnThreshold) return COUNTDOWN_TICK_MS;
  // Land exactly on the threshold rather than one whole interval past it.
  return Math.max(MIN_TICK_MS, Math.min(coarseIntervalMs, warnThreshold - idleForMs));
};

/**
 * Logs the user out after a period of *inactivity* (no user input).
 * Mount once near the app root. Uses shared activityTracker.
 *
 * Scheduling is self-adjusting rather than a fixed interval. A 15-minute
 * timeout derives a 30-second poll, which is accurate enough to decide "log out
 * eventually" and nowhere near accurate enough to drive a countdown: the
 * warning could arrive with 30 of its 60 seconds already gone, and the sign-out
 * could land half a minute after the display reached zero. So the loop sleeps
 * exactly up to the warning threshold, then ticks every second while a
 * countdown is on screen.
 *
 * @param {object}   options
 * @param {boolean}  options.enabled
 * @param {number}   options.timeoutMs           idle duration that ends the session
 * @param {Function} options.onIdle              called once when the timeout is reached
 * @param {Function} options.onWarning           called once on entering the warning window
 * @param {Function} options.onWarningCleared    called when activity cancels a shown warning
 * @param {number}   options.warnBeforeMs        how long before the timeout to warn
 * @param {number}   options.checkIntervalMs     override for the coarse poll
 */
export const useIdleLogout = ({
  enabled,
  timeoutMs,
  onIdle,
  onWarning,
  onWarningCleared,
  warnBeforeMs = 60_000,
  checkIntervalMs,
}) => {
  const idleTriggeredRef = useRef(false);
  const warningShownRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  const onWarningRef = useRef(onWarning);
  const onWarningClearedRef = useRef(onWarningCleared);

  onIdleRef.current = onIdle;
  onWarningRef.current = onWarning;
  onWarningClearedRef.current = onWarningCleared;

  // The coarse poll, used only while the deadline is still far away.
  const coarseIntervalMs = useMemo(() => {
    const fallback = 1000;
    const max = 30000;
    const derived =
      typeof timeoutMs === 'number' && timeoutMs > 0
        ? Math.floor(timeoutMs / 4)
        : fallback;
    return Math.max(fallback, Math.min(max, checkIntervalMs ?? derived));
  }, [timeoutMs, checkIntervalMs]);

  useEffect(() => {
    if (!enabled) return;
    if (!timeoutMs || timeoutMs <= 0) return;

    ensureActivityListeners();
    idleTriggeredRef.current = false;
    warningShownRef.current = false;
    // Adopt the clock rather than restart it: sign-in and session restore have
    // both already stamped it, and this effect re-runs on transitions the user
    // had no part in. See ensureActivityStamp.
    ensureActivityStamp();

    /*
     * Never warn for more than half the window. VITE_IDLE_LOGOUT_TIMEOUT_MS is
     * meant to be overridden, and the first thing anyone testing this does is
     * set it below the 60s warning — at which point the threshold pins to zero
     * and the countdown greets them the instant they sign in.
     */
    const effectiveWarnMs = Math.min(Math.max(0, warnBeforeMs ?? 0), Math.floor(timeoutMs / 2));
    const warnThreshold = timeoutMs - effectiveWarnMs;
    let timerId = null;
    let cancelled = false;

    /** Sleep until the next moment something could actually happen. */
    const nextDelay = (idleForMs) =>
      idleTickDelay(idleForMs, { warnThreshold, coarseIntervalMs });

    const schedule = (delay) => {
      if (cancelled) return;
      timerId = globalThis.setTimeout(tick, delay);
    };

    async function tick() {
      if (cancelled) return;
      const idleForMs = getIdleDurationMs();

      if (idleForMs >= timeoutMs) {
        if (idleTriggeredRef.current) return;
        idleTriggeredRef.current = true;
        try {
          await onIdleRef.current?.({ idleForMs, timeoutMs });
          // The session is over; `enabled` is about to go false and tear this
          // effect down. Nothing left to schedule.
          return;
        } catch (err) {
          // Let it be retried — a failed sign-out must not leave the session up.
          idleTriggeredRef.current = false;
          console.error('Idle logout failed:', err);
        }
      } else if (
        effectiveWarnMs > 0 &&
        idleForMs >= warnThreshold &&
        !warningShownRef.current
      ) {
        warningShownRef.current = true;
        try {
          await onWarningRef.current?.({
            idleForMs,
            timeoutMs,
            remainingMs: timeoutMs - idleForMs,
          });
        } catch (err) {
          console.error('Idle warning callback failed:', err);
        }
      }

      // Re-read: an await above may have taken time, and the user may have
      // become active during it.
      schedule(nextDelay(getIdleDurationMs()));
    }

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      // Timers are throttled or frozen in a hidden tab, so the moment it comes
      // back is the moment to look. The elapsed time is real whether or not a
      // timer got to fire while the tab was away.
      if (timerId) globalThis.clearTimeout(timerId);
      tick();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    schedule(nextDelay(getIdleDurationMs()));

    return () => {
      cancelled = true;
      if (timerId) globalThis.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, timeoutMs, warnBeforeMs, coarseIntervalMs]);

  // Reset warning / logout guards when the user interacts again.
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeActivity(() => {
      if (warningShownRef.current) {
        warningShownRef.current = false;
        try {
          onWarningClearedRef.current?.();
        } catch (err) {
          console.error('Idle warning-cleared callback failed:', err);
        }
      }
      idleTriggeredRef.current = false;
    });
  }, [enabled]);
};

export default useIdleLogout;
