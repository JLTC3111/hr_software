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
