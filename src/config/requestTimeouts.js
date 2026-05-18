// Centralized request timeout values
export const DEFAULT_REQUEST_TIMEOUT = 900000; // 900 seconds / 15 minutes
export const VISIBILITY_STALE_TIMEOUT = 900000; // 900 seconds / 15 minutes

// Global idle timeout for forced logout (app-wide)
// Can be overridden via Vite env var: VITE_IDLE_LOGOUT_TIMEOUT_MS
export const IDLE_LOGOUT_TIMEOUT = (() => {
  const raw = import.meta?.env?.VITE_IDLE_LOGOUT_TIMEOUT_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 900000;
})();

/** Only refresh JWT while the user was active within this window (matches idle logout). */
export const SESSION_KEEPALIVE_ACTIVITY_MS = IDLE_LOGOUT_TIMEOUT;

export const IDLE_LOGOUT_WARN_BEFORE_MS = 60_000;

export const LOGOUT_REASON_KEY = 'hr_app_logout_reason';
