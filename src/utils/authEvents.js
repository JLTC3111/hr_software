/**
 * Supabase emits SIGNED_IN when it re-confirms an unchanged stored session,
 * including when a browser tab becomes visible again. That is not a new login.
 */
export const isRepeatedSessionSignIn = (activeAccessToken, nextSession) =>
  Boolean(
    activeAccessToken &&
    nextSession?.access_token &&
    activeAccessToken === nextSession.access_token
  );

/** Capture recovery before the SDK clears the hash; accept only its matching session, once. */
export const createRecoverySessionConsumer = (hash = globalThis.location?.hash || '') => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  let token = params.get('type') === 'recovery' && !params.has('error') && !params.has('error_code')
    ? params.get('access_token')
    : null;
  return (session) => {
    if (!token || session?.access_token !== token) return false;
    token = null;
    return true;
  };
};
