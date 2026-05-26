import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  handleSessionAuthError as handleSessionAuthErrorUtil,
  validateAndRefreshSession,
} from '../utils/sessionHelper.js';
import { isDemoMode } from '../utils/demoHelper.js';
import { useVisibilityRefresh } from './useVisibilityRefresh.js';
import { VISIBILITY_STALE_TIMEOUT } from '../config/requestTimeouts.js';

/**
 * Validate session before protected API calls (skipped in demo mode).
 * @throws {Error} when session is invalid
 */
export const ensureValidSession = async () => {
  if (isDemoMode()) {
    return true;
  }
  const validation = await validateAndRefreshSession();
  if (!validation.success) {
    throw new Error(validation.error || 'No active session. Please sign in again.');
  }
  return true;
};

/**
 * Shared session guard for authenticated pages: force logout on expired sessions
 * and optionally refresh data after idle/tab switches (same as time tracking).
 */
export const useSessionGuard = () => {
  const { logout } = useAuth();

  const handleSessionAuthError = useCallback(
    (error, options = {}) =>
      handleSessionAuthErrorUtil(error, { logout, ...options }),
    [logout]
  );

  /** Run async work with optional pre-validation and session-error logout. */
  const runGuarded = useCallback(
    async (fn, options = {}) => {
      const { validateSession = true, ...errorOptions } = options;
      try {
        if (validateSession) {
          await ensureValidSession();
        }
        return await fn();
      } catch (error) {
        if (handleSessionAuthError(error, errorOptions)) {
          return undefined;
        }
        throw error;
      }
    },
    [handleSessionAuthError]
  );

  return { handleSessionAuthError, ensureValidSession, runGuarded };
};

/**
 * Registers visibility/focus/online refresh for a page-level data loader.
 */
export const useAuthenticatedPageRefresh = (refreshCallback, options = {}) => {
  useVisibilityRefresh(refreshCallback, {
    staleTime: VISIBILITY_STALE_TIMEOUT,
    refreshOnFocus: true,
    refreshOnOnline: true,
    ...options,
  });
};

export default useSessionGuard;
