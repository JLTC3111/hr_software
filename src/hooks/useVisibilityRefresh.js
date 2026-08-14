import { useEffect, useRef, useCallback } from 'react';

export const isRefreshDue = (
  lastRefreshTime,
  staleTime,
  now = Date.now(),
  force = false
) => force || now - lastRefreshTime >= staleTime;

/**
 * 
 * @param {Function} refreshCallback - Function to call when data needs refreshing
 * @param {Object} options - Configuration options
 * @param {number} options.staleTime - Time in ms after which data is considered stale (default: 90000 = 90 seconds)
 * @param {boolean} options.refreshOnFocus - Whether to refresh on window focus (default: true)
 * @param {boolean} options.refreshOnOnline - Whether to refresh when coming back online (default: true)
 * @param {Function} options.onStaleTimeout - Callback to run when stale time is exceeded (optional)
 */
export const useVisibilityRefresh = (refreshCallback, options = {}) => {
  const {
    staleTime = 90000, 
    refreshOnFocus = true,
    refreshOnOnline = true,
    onStaleTimeout
  } = options;

  const lastRefreshTime = useRef(Date.now());
  const isRefreshing = useRef(false);

  const handleRefresh = useCallback(async ({ force = false } = {}) => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;

    // Only refresh if data is stale
    if (!isRefreshDue(lastRefreshTime.current, staleTime, now, force)) {
      return;
    }

    // Prevent concurrent refreshes
    if (isRefreshing.current) {
      return;
    }

    isRefreshing.current = true;
    lastRefreshTime.current = now;

    try {
      if (onStaleTimeout) {
        await onStaleTimeout({ timeSinceLastRefresh, staleTime });
        return;
      }
      await refreshCallback();
    } catch (error) {
      console.error('Error during visibility refresh:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, [refreshCallback, staleTime, onStaleTimeout]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };

    const handleFocus = () => {
      if (refreshOnFocus) {
        handleRefresh();
      }
    };

    const handleOnline = () => {
      if (refreshOnOnline) {
        // Reconnecting is the one event that deliberately refreshes fresh data.
        handleRefresh({ force: !onStaleTimeout });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    if (refreshOnFocus) {
      globalThis.addEventListener('focus', handleFocus);
    }
    
    if (refreshOnOnline) {
      globalThis.addEventListener('online', handleOnline);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshOnFocus) {
        globalThis.removeEventListener('focus', handleFocus);
      }
      if (refreshOnOnline) {
        globalThis.removeEventListener('online', handleOnline);
      }
    };
  }, [handleRefresh, refreshOnFocus, refreshOnOnline, onStaleTimeout]);

  // Enforce staleness even while staying on the same visible tab
  useEffect(() => {
    if (!staleTime) return undefined;

    const interval = Math.max(1000, Math.min(30000, Math.floor(staleTime / 2)));
    const timerId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    }, interval);

    return () => {
      clearInterval(timerId);
    };
  }, [handleRefresh, staleTime]);

  // Return a function to manually trigger refresh and reset the timer
  const manualRefresh = useCallback(async () => {
    lastRefreshTime.current = Date.now();
    isRefreshing.current = false;
    await refreshCallback();
  }, [refreshCallback]);

  return { manualRefresh };
};

export default useVisibilityRefresh;
