import { useEffect, useRef, useCallback } from 'react';

/**
 * 
 * @param {Function} refreshCallback - Function to call when data needs refreshing
 * @param {Object} options - Configuration options
 * @param {number} options.staleTime - Time in ms after which data is considered stale (default: 60000 = 1 minute)
 * @param {boolean} options.refreshOnFocus - Whether to refresh on window focus (default: true)
 * @param {boolean} options.refreshOnOnline - Whether to refresh when coming back online (default: true)
 */
export const useVisibilityRefresh = (refreshCallback, options = {}) => {
  const {
    staleTime = 60000, 
    refreshOnFocus = true,
    refreshOnOnline = true
  } = options;

  const lastRefreshTime = useRef(Date.now());
  const isRefreshing = useRef(false);

  const handleRefresh = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshTime.current;

    // Only refresh if data is stale
    if (timeSinceLastRefresh < staleTime) {
      return;
    }

    // Prevent concurrent refreshes
    if (isRefreshing.current) {
      return;
    }

    isRefreshing.current = true;
    lastRefreshTime.current = now;

    try {
      await refreshCallback();
    } catch (error) {
      console.error('Error during visibility refresh:', error);
    } finally {
      isRefreshing.current = false;
    }
  }, [refreshCallback, staleTime]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Force next refresh by resetting timer when user returns
        lastRefreshTime.current = 0;
        handleRefresh();
      }
    };

    const handleFocus = () => {
      if (refreshOnFocus) {
        lastRefreshTime.current = 0;
        handleRefresh();
      }
    };

    const handleOnline = () => {
      if (refreshOnOnline) {
        // Reset stale time to force refresh when coming back online
        lastRefreshTime.current = 0;
        handleRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    if (refreshOnFocus) {
      window.addEventListener('focus', handleFocus);
    }
    
    if (refreshOnOnline) {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (refreshOnFocus) {
        window.removeEventListener('focus', handleFocus);
      }
      if (refreshOnOnline) {
        window.removeEventListener('online', handleOnline);
      }
    };
  }, [handleRefresh, refreshOnFocus, refreshOnOnline]);

  // Return a function to manually trigger refresh and reset the timer
  const manualRefresh = useCallback(async () => {
    lastRefreshTime.current = Date.now();
    isRefreshing.current = false;
    await refreshCallback();
  }, [refreshCallback]);

  return { manualRefresh };
};

export default useVisibilityRefresh;
