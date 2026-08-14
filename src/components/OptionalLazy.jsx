import { useCallback, useEffect, useRef, useState } from 'react';
import OptionalChunkBoundary from './OptionalChunkBoundary.jsx';
import { isChunkLoadError, revalidateChunkCache } from '../utils/lazyWithRetry.js';

const isOnline = () =>
  typeof navigator === 'undefined' || navigator.onLine !== false;

/**
 * Loads non-essential UI without letting a failed import poison React.lazy.
 *
 * Offline tabs make no request. A failed request is tried again only after a
 * useful recovery signal (online, focus, or becoming visible). If the browser
 * cached a failed chunk request, one targeted cache revalidation is allowed
 * before retrying the import.
 */
const OptionalLazy = ({ load, fallback = null, label = 'Optional UI', ...props }) => {
  const [Component, setComponent] = useState(null);
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const loadedRef = useRef(false);

  const tryLoad = useCallback(async () => {
    if (
      !mountedRef.current ||
      inFlightRef.current ||
      loadedRef.current ||
      !isOnline()
    ) {
      return;
    }

    inFlightRef.current = true;

    try {
      let module;
      try {
        module = await load();
      } catch (error) {
        if (!isChunkLoadError(error) || !isOnline()) throw error;

        // Retry only when the failed asset was actually recovered. A 404 from
        // an old deployment or a dead connection does not trigger another
        // identical dynamic import.
        const recovered = await revalidateChunkCache(error);
        if (!recovered) throw error;
        module = await load();
      }

      if (!module?.default) {
        throw new TypeError(`${label} module has no default export`);
      }

      if (mountedRef.current) {
        loadedRef.current = true;
        setComponent(() => module.default);
      }
    } catch (error) {
      if (mountedRef.current) {
        console.warn(`${label} unavailable; continuing without it:`, error);
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [label, load]);

  useEffect(() => {
    mountedRef.current = true;

    const handleOnline = () => void tryLoad();
    const handleFocus = () => void tryLoad();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') void tryLoad();
    };

    globalThis.addEventListener('online', handleOnline);
    globalThis.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    void tryLoad();

    return () => {
      mountedRef.current = false;
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [tryLoad]);

  if (!Component) return fallback;

  return (
    <OptionalChunkBoundary fallback={fallback}>
      <Component {...props} />
    </OptionalChunkBoundary>
  );
};

export default OptionalLazy;
