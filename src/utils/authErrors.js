/**
 * Classifying auth failures.
 *
 * Kept free of any Supabase import so the rule can be tested on its own: it
 * decides whether a user's persisted token is destroyed, and that is not a
 * decision to leave unexercised.
 */

/**
 * True only when the server actually rejected the credentials, as opposed to
 * the request never reaching it.
 *
 * The distinction decides whether a stored token gets thrown away. A 401 proves
 * the session is dead; a timeout on a train proves nothing, and treating the
 * second as the first signs people out for changing networks. GoTrue marks
 * unreachable-server failures with AuthRetryableFetchError, and our own fetch
 * wrapper aborts with an AbortError once DEFAULT_REQUEST_TIMEOUT elapses.
 *
 * Anything unrecognised is treated as *not* rejected: leaving a dead token in
 * place costs one more failed reload, while wiping a live one costs the user
 * their session.
 */
export const isRejectedByServer = (error) => {
  if (!error) return false;

  if (
    error.name === 'AuthRetryableFetchError' ||
    error.name === 'AbortError' ||
    error.name === 'TypeError'
  ) {
    return false;
  }

  const status = Number(error.status ?? error.statusCode ?? 0);
  // 5xx is the server failing, not the credentials being refused.
  if (status >= 500) return false;
  if (status >= 400) return true;

  const message = (error.message || '').toLowerCase();
  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('aborted') ||
    message.includes('timeout') ||
    message.includes('timed out')
  ) {
    return false;
  }

  return (
    message.includes('invalid jwt') ||
    message.includes('jwt expired') ||
    message.includes('token is expired') ||
    message.includes('user not found') ||
    message.includes('user from sub claim') ||
    message.includes('invalid claim') ||
    message.includes('not authenticated') ||
    message.includes('auth session missing')
  );
};

export default isRejectedByServer;

/** Show a safe, translated reason without exposing raw provider diagnostics. */
export const getPasswordResetErrorKey = (error) => {
  const code = error?.code;
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  if (code === 'over_email_send_rate_limit' || message.includes('email rate limit')) {
    return 'login.forgotPasswordModal.emailRateLimitError';
  }
  if (status === 429 || code === 'over_request_rate_limit' || message.includes('rate limit')) {
    return 'login.forgotPasswordModal.rateLimitError';
  }
  if (code === 'email_address_invalid') return 'login.forgotPasswordModal.emailInvalid';
  if (status < 500 && (
    error?.name === 'AuthRetryableFetchError' || error?.name === 'AbortError' ||
    message.includes('failed to fetch') || message.includes('network') ||
    message.includes('timed out') || message.includes('timeout')
  )) return 'login.forgotPasswordModal.networkError';
  return 'login.forgotPasswordModal.error';
};
