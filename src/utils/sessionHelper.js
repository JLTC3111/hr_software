import { supabase } from '../config/supabaseClient';

/**
 * Validates the current Supabase session and refreshes if needed
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export const validateAndRefreshSession = async () => {
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session error:', sessionError);
      return {
        success: false,
        error: `Session error: ${sessionError.message}`
      };
    }
    
    if (!session) {
      console.error('❌ No active session');
      return {
        success: false,
        error: 'No active session. Please sign in again.'
      };
    }
    
    // Check if session is about to expire (within 5 minutes)
    if (session.expires_at) {
      const expiresAt = new Date(session.expires_at * 1000);
      const now = new Date();
      const timeUntilExpiry = expiresAt.getTime() - now.getTime();
      const fiveMinutes = 5 * 60 * 1000;

      if (timeUntilExpiry < fiveMinutes) {
        console.log('🔄 Session expiring soon, refreshing...');
        const { data: { session: newSession } = {}, error: refreshError } = await supabase.auth.refreshSession();

        if (refreshError) {
          console.warn('⚠️ Session refresh failed:', refreshError);
          // Don't throw - the proactive refresh hook will handle it
          return {
            success: true,
            warning: 'Session refresh failed but will be retried by background refresh'
          };
        }

        if (!newSession) {
          return {
            success: false,
            error: 'Failed to refresh session. Please sign in again.'
          };
        }

        console.log('✅ Session refreshed successfully');
      } else {
        console.log('✅ Session valid, expires in:', Math.round(timeUntilExpiry / 60000), 'minutes');
      }
    }

    return { success: true };
    
  } catch (error) {
    console.error('❌ Session validation error:', error);
    return {
      success: false,
      error: error.message || 'Failed to validate session'
    };
  }
};

/**
 * Wraps a fetch function with session validation
 * @param {Function} fetchFn - The fetch function to wrap
 * @param {Object} options - Options for the fetch
 * @returns {Promise<any>} The result of the fetch function
 */
export const withSessionValidation = async (fetchFn, options = {}) => {
  // Validate session first
  const validation = await validateAndRefreshSession();
  
  if (!validation.success) {
    throw new Error(validation.error);
  }
  
  if (validation.warning) {
    console.warn(validation.warning);
  }
  
  // Execute the actual fetch
  return await fetchFn(options);
};
