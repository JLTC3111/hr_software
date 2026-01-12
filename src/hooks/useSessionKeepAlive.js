import { useEffect, useRef } from 'react';
import { supabase } from '../config/supabaseClient';

/**
 * Hook to keep user session alive with proactive token refresh
 * This mimics Google/YouTube's approach to keeping users logged in
 */
export const useSessionKeepAlive = () => {
  const refreshIntervalRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const isRefreshingRef = useRef(false);

  /**
   * Proactively refresh session before it expires
   */
  const proactiveRefresh = async () => {
    if (isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
      
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || !session) {
        console.log('⚠️ No active session to refresh');
        return;
      }

      // Check if session expires within 10 minutes
      if (session.expires_at) {
        const expiresAt = session.expires_at * 1000;
        const now = Date.now();
        const timeUntilExpiry = expiresAt - now;
        const tenMinutes = 10 * 60 * 1000;

        if (timeUntilExpiry < tenMinutes) {
          console.log(`🔄 Proactively refreshing session (expires in ${Math.round(timeUntilExpiry / 60000)} minutes)...`);
          
          const { data, error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.error('❌ Failed to refresh session:', refreshError);
          } else if (data.session) {
            console.log('✅ Session refreshed proactively');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in proactive refresh:', error);
    } finally {
      isRefreshingRef.current = false;
    }
  };

  /**
   * Activity-based refresh - refresh on user activity
   */
  const onUserActivity = async () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    // Only check if it's been more than 5 minutes since last activity check
    if (timeSinceLastActivity > 5 * 60 * 1000) {
      lastActivityRef.current = now;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.expires_at) {
          const expiresAt = session.expires_at * 1000;
          const timeUntilExpiry = expiresAt - now;
          const fifteenMinutes = 15 * 60 * 1000;
          
          // If expires within 15 minutes and user is active, refresh
          if (timeUntilExpiry < fifteenMinutes) {
            console.log('🔄 Activity-based refresh triggered');
            await proactiveRefresh();
          }
        }
      } catch (error) {
        console.error('Error in activity-based refresh:', error);
      }
    }
  };

  // Set up proactive refresh interval
  useEffect(() => {
    console.log('🔐 Session keep-alive initialized');
    
    // Run proactive refresh every 5 minutes
    refreshIntervalRef.current = setInterval(() => {
      proactiveRefresh();
    }, 5 * 60 * 1000);

    // Run initial check after 1 minute
    const initialTimeout = setTimeout(() => {
      proactiveRefresh();
    }, 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
      clearTimeout(initialTimeout);
      console.log('🔐 Session keep-alive cleaned up');
    };
  }, []);

  // Set up activity listeners
  useEffect(() => {
    // Debounced activity handler
    let activityTimeout;
    const handleActivity = () => {
      clearTimeout(activityTimeout);
      activityTimeout = setTimeout(() => {
        onUserActivity();
      }, 1000); // Debounce by 1 second
    };

    // Listen to user activity
    window.addEventListener('click', handleActivity);
    window.addEventListener('keypress', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('mousemove', handleActivity);

    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('mousemove', handleActivity);
      clearTimeout(activityTimeout);
    };
  }, []);

  return { proactiveRefresh };
};
