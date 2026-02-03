import { useEffect, useMemo, useRef } from 'react';

const DEFAULT_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'pointerdown'
];

/**
 * Logs the user out after a period of *inactivity*.
 *
 * Inactivity is defined as no user input events for `timeoutMs`.
 * This is intentionally app-wide (mount it once near the app root).
 */
export const useIdleLogout = ({
  enabled,
  timeoutMs,
  onIdle,
  events = DEFAULT_EVENTS,
  checkIntervalMs
}) => {
  const lastActivityAtRef = useRef(Date.now());
  const idleTriggeredRef = useRef(false);

  const intervalMs = useMemo(() => {
    const fallback = 1000;
    const max = 30000;
    const derived = typeof timeoutMs === 'number' && timeoutMs > 0 ? Math.floor(timeoutMs / 4) : fallback;
    return Math.max(fallback, Math.min(max, checkIntervalMs ?? derived));
  }, [timeoutMs, checkIntervalMs]);

  useEffect(() => {
    if (!enabled) return;
    if (!timeoutMs || timeoutMs <= 0) return;
    if (typeof onIdle !== 'function') return;

    idleTriggeredRef.current = false;
    lastActivityAtRef.current = Date.now();

    const checkIdleNow = async () => {
      if (idleTriggeredRef.current) return;

      const now = Date.now();
      const idleForMs = now - lastActivityAtRef.current;
      if (idleForMs < timeoutMs) return;

      idleTriggeredRef.current = true;
      try {
        await onIdle({ idleForMs, timeoutMs });
      } catch (err) {
        // If logout fails, allow a future retry.
        idleTriggeredRef.current = false;
        // eslint-disable-next-line no-console
        console.error('Idle logout failed:', err);
      }
    };

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
      idleTriggeredRef.current = false;
    };

    // If the user returns to the tab, immediately evaluate whether they exceeded idle timeout.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkIdleNow();
      }
    };

    const listenerOptions = { passive: true };
    events.forEach((evt) => globalThis.addEventListener(evt, markActivity, listenerOptions));
    document.addEventListener('visibilitychange', handleVisibility);

    const timerId = globalThis.setInterval(async () => {
      await checkIdleNow();
    }, intervalMs);

    return () => {
      globalThis.clearInterval(timerId);
      events.forEach((evt) => globalThis.removeEventListener(evt, markActivity, listenerOptions));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [enabled, timeoutMs, onIdle, events, intervalMs]);
};

export default useIdleLogout;
