import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabaseClient.js';
import {
  ensureActivityListeners,
  isRecentlyActive,
} from '../utils/activityTracker.js';
import { SESSION_KEEPALIVE_ACTIVITY_MS } from '../config/requestTimeouts.js';

/**
 * Refreshes the Supabase session only while the user has been recently active.
 * Prevents indefinite sessions when idle logout is configured.
 */
export const useSessionKeepAlive = ({ enabled = true } = {}) => {
  const isRefreshingRef = useRef(false);

  const proactiveRefresh = async () => {
    if (!enabled) return;
    if (!isRecentlyActive(SESSION_KEEPALIVE_ACTIVITY_MS)) {
      return;
    }
    if (isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) return;

      if (session.expires_at) {
        const expiresAt = session.expires_at * 1000;
        const timeUntilExpiry = expiresAt - Date.now();
        const tenMinutes = 10 * 60 * 1000;

        if (timeUntilExpiry < tenMinutes) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            console.warn('Session refresh failed:', refreshError.message);
          }
        }
      }
    } catch (error) {
      console.warn('Session keep-alive error:', error?.message || error);
    } finally {
      isRefreshingRef.current = false;
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;

    ensureActivityListeners();

    const intervalId = setInterval(proactiveRefresh, 5 * 60 * 1000);
    const initialTimeout = setTimeout(proactiveRefresh, 60 * 1000);

    return () => {
      clearInterval(intervalId);
      clearTimeout(initialTimeout);
    };
  }, [enabled]);
};

export default useSessionKeepAlive;
