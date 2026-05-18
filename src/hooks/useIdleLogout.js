import { useEffect, useMemo, useRef } from 'react';
import {
  ensureActivityListeners,
  getIdleDurationMs,
  resetActivity,
  subscribeActivity,
} from '../utils/activityTracker.js';

/**
 * Logs the user out after a period of *inactivity* (no user input).
 * Mount once near the app root. Uses shared activityTracker.
 */
export const useIdleLogout = ({
  enabled,
  timeoutMs,
  onIdle,
  onWarning,
  warnBeforeMs = 60_000,
  checkIntervalMs,
}) => {
  const idleTriggeredRef = useRef(false);
  const warningShownRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  const onWarningRef = useRef(onWarning);

  onIdleRef.current = onIdle;
  onWarningRef.current = onWarning;

  const intervalMs = useMemo(() => {
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
    resetActivity();

    const checkIdleNow = async () => {
      if (idleTriggeredRef.current) return;

      const idleForMs = getIdleDurationMs();
      if (idleForMs < timeoutMs) {
        const warnThreshold = timeoutMs - (warnBeforeMs ?? 0);
        if (
          onWarningRef.current &&
          warnBeforeMs > 0 &&
          idleForMs >= warnThreshold &&
          !warningShownRef.current
        ) {
          warningShownRef.current = true;
          try {
            await onWarningRef.current({
              idleForMs,
              timeoutMs,
              remainingMs: timeoutMs - idleForMs,
            });
          } catch (err) {
            console.error('Idle warning callback failed:', err);
          }
        }
        return;
      }

      idleTriggeredRef.current = true;
      try {
        if (typeof onIdleRef.current === 'function') {
          await onIdleRef.current({ idleForMs, timeoutMs });
        }
      } catch (err) {
        idleTriggeredRef.current = false;
        console.error('Idle logout failed:', err);
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkIdleNow();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const timerId = globalThis.setInterval(() => {
      checkIdleNow();
    }, intervalMs);

    return () => {
      globalThis.clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, timeoutMs, warnBeforeMs, intervalMs]);

  // Reset warning / logout guards when the user interacts again
  useEffect(() => {
    if (!enabled) return undefined;
    return subscribeActivity(() => {
      warningShownRef.current = false;
      idleTriggeredRef.current = false;
    });
  }, [enabled]);
};

export default useIdleLogout;
