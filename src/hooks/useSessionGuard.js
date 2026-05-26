import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { handleSessionAuthError as handleSessionAuthErrorUtil } from '../utils/sessionHelper.js';
import { useVisibilityRefresh } from './useVisibilityRefresh.js';
import { VISIBILITY_STALE_TIMEOUT } from '../config/requestTimeouts.js';

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

  return { handleSessionAuthError };
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
