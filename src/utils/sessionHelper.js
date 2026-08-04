import { supabase } from '../config/supabaseClient';
import { isDemoMode } from './demoHelper.js';
import { LOGOUT_REASON_KEY } from '../config/requestTimeouts.js';
import { isRejectedByServer } from './authErrors.js';

/* Re-exported so callers keep importing their session helpers from one place. */
export { isRejectedByServer };

export const SESSION_LOGOUT_DELAY_MS = 2000;

export const isSessionAuthError = (error) => {
  const errorMsg = (error?.message || String(error || '')).toLowerCase();
  return (
    errorMsg.includes('session') ||
    errorMsg.includes('authentication') ||
    errorMsg.includes('no active session') ||
    errorMsg.includes('jwt expired') ||
    errorMsg.includes('invalid jwt')
  );
};

/**
 * How long a server-side verification stays good for. Below this the local
 * token is taken at face value; past it the next validation asks the server.
 */
export const SESSION_VERIFY_INTERVAL_MS = 5 * 60 * 1000;

/**
 * When the session was last proved valid *by the server* — a getUser() call or
 * a successful token refresh, both of which round-trip. Reading storage does
 * not count, which is the whole point: a persisted token says a session once
 * existed, not that it still does. A token revoked elsewhere, a deleted user,
 * or a sign-out on another device all leave the stored JWT parsing perfectly
 * well until it expires on its own.
 */
let lastVerifiedAt = 0;
let verifyInFlight = null;

/** Record that the server has just confirmed the session. */
export const markSessionVerified = () => {
  lastVerifiedAt = Date.now();
};

/** Forget the confirmation, so the next validation round-trips again. */
export const resetSessionVerification = () => {
  lastVerifiedAt = 0;
  verifyInFlight = null;
};

/**
 * Ask the server whether the session is still real. Shared between concurrent
 * callers so a screenful of parallel fetches costs one request.
 *
 * @returns {Promise<{ok: boolean, rejected: boolean, error?: string}>}
 *          `ok` false with `rejected` false means we could not reach the server
 *          — unproven, not invalid, so callers should not sign anyone out.
 */
const verifyWithServer = async () => {
  if (verifyInFlight) return verifyInFlight;

  verifyInFlight = (async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        if (isRejectedByServer(error)) {
          return { ok: false, rejected: true, error: error?.message || 'Session is no longer valid' };
        }
        return { ok: false, rejected: false, error: error?.message || 'Could not reach the auth server' };
      }
      markSessionVerified();
      return { ok: true, rejected: false };
    } catch (error) {
      return { ok: false, rejected: false, error: error?.message || 'Could not reach the auth server' };
    } finally {
      verifyInFlight = null;
    }
  })();

  return verifyInFlight;
};

// At most one forced logout may ever be pending. After an idle period several
// pages fail their fetches at once, and each used to queue its own delayed
// logout; the stragglers then fired while the user was already re-entering
// credentials, taking GoTrue's lock and wiping storage mid-sign-in.
let scheduledLogoutTimer = null;

/**
 * Drop any pending forced logout. Called when a fresh sign-in starts so a
 * logout queued by the previous session cannot land on top of it.
 */
export const cancelScheduledLogout = () => {
  if (scheduledLogoutTimer) {
    clearTimeout(scheduledLogoutTimer);
    scheduledLogoutTimer = null;
  }
};

/**
 * Force logout when a fetch fails due to an invalid/expired session.
 * Returns true if the error was handled (caller should stop further error UI).
 */
export const handleSessionAuthError = (error, { logout, silent = false, setFetchError, demoMessage } = {}) => {
  if (!isSessionAuthError(error)) {
    return false;
  }

  if (isDemoMode()) {
    console.warn('🧪 Demo mode session not ready, skipping forced logout');
    if (!silent && typeof setFetchError === 'function') {
      setFetchError(
        demoMessage || 'Demo session is initializing. Please try again in a moment.'
      );
    }
    return true;
  }

  console.error('🚪 Session invalid after retries, forcing logout...');
  if (!silent && typeof setFetchError === 'function') {
    setFetchError('Your session has expired. Redirecting to login...');
  }

  sessionStorage.setItem(LOGOUT_REASON_KEY, 'session');
  if (!scheduledLogoutTimer) {
    scheduledLogoutTimer = setTimeout(() => {
      scheduledLogoutTimer = null;
      logout?.();
    }, SESSION_LOGOUT_DELAY_MS);
  }

  return true;
};

// Global promise used to serialize session refresh calls so only one refresh runs at a time
let refreshInProgress = null;

/**
 * Validates the current Supabase session, refreshing it when it is close to
 * expiry and confirming it against the server when the last confirmation has
 * gone stale.
 *
 * getSession() alone is not a validity check: it decodes whatever is in
 * storage. Every screen calls this before fetching, so it is where the
 * distinction has to be enforced — but not on every call, or each fetch would
 * carry an extra round-trip. Hence SESSION_VERIFY_INTERVAL_MS, with a refresh
 * counting as a confirmation because it round-trips too.
 *
 * @param {object}  options
 * @param {boolean} options.quiet        suppress the informational logging
 * @param {boolean} options.forceVerify  round-trip regardless of the interval
 * @param {boolean} options.skipVerify   local checks only (used by the poller)
 * @returns {Promise<{success: boolean, error?: string, unverified?: boolean}>}
 */
export const validateAndRefreshSession = async (options = {}) => {
  const { quiet = false, forceVerify = false, skipVerify = false } = options;
  try {
    // Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      if (!quiet) {
        console.warn('Session error:', sessionError);
      }
      return {
        success: false,
        error: `Session error: ${sessionError.message}`
      };
    }
    
    if (!session) {
      if (!quiet) {
        console.warn('No active session');
      }
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

        try {
          // If another refresh is in progress, wait for it instead of starting a new one
          if (refreshInProgress) {
            const res = await refreshInProgress;
            const newSession = res?.data?.session;
            const refreshError = res?.error;

            if (refreshError) {
              console.warn('⚠️ Session refresh (concurrent) failed:', refreshError);
              return { success: false, error: refreshError.message || 'Session refresh failed' };
            }

            if (!newSession) {
              return { success: false, error: 'Failed to refresh session. Please sign in again.' };
            }

            console.log('✅ Session refreshed by concurrent worker');
            /* A refresh is a server round-trip that the refresh token had to
               survive — that is a stronger proof than getUser(). */
            markSessionVerified();
          } else {
            // Start a refresh and store the promise so other callers can await it
            refreshInProgress = supabase.auth.refreshSession();
            const { data: { session: newSession } = {}, error: refreshError } = await refreshInProgress;
            refreshInProgress = null;

            if (refreshError) {
              console.warn('⚠️ Session refresh failed:', refreshError);
              return { success: false, error: refreshError.message || 'Session refresh failed' };
            }

            if (!newSession) {
              return { success: false, error: 'Failed to refresh session. Please sign in again.' };
            }

            console.log('✅ Session refreshed successfully');
            markSessionVerified();
          }
        } catch (err) {
          // Ensure the global promise is cleared on unexpected errors
          refreshInProgress = null;
          console.error('❌ Unexpected error during session refresh:', err);
          return { success: false, error: err.message || 'Session refresh failed' };
        }
      } else if (!quiet) {
        console.log('✅ Session valid, expires in:', Math.round(timeUntilExpiry / 60000), 'minutes');
      }
    }

    /*
     * Everything above this line was decided from the stored token. Ask the
     * server whether it still stands behind it — the token parses and has not
     * expired even after it has been revoked, the user deleted, or a sign-out
     * performed on another device.
     */
    if (!skipVerify) {
      const stale = Date.now() - lastVerifiedAt > SESSION_VERIFY_INTERVAL_MS;
      if (forceVerify || stale) {
        const verdict = await verifyWithServer();
        if (!verdict.ok) {
          if (verdict.rejected) {
            if (!quiet) console.warn('🚫 Server rejected the stored session:', verdict.error);
            return { success: false, error: verdict.error || 'Session is no longer valid. Please sign in again.' };
          }
          /* Unreachable server proves nothing. Let the caller proceed on the
             local token and report the doubt rather than signing anyone out
             because their connection dropped. */
          if (!quiet) console.warn('⚠️ Could not verify the session with the server:', verdict.error);
          return { success: true, unverified: true, error: verdict.error };
        }
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
