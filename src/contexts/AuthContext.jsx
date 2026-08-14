import _React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, hasPermission, Permissions, customStorage, clearAuthStorage } from '../config/supabaseClient.js';
import {
  validateAndRefreshSession,
  handleSessionAuthError as handleSessionAuthErrorUtil,
  cancelScheduledLogout,
  isRejectedByServer,
  markSessionVerified,
  resetSessionVerification,
} from '../utils/sessionHelper.js';
import { isDemoMode, enableDemoMode, disableDemoMode, MOCK_USER, getDemoEmployees, attachSeededRandomUserPhotos, DEMO_CONFIG } from '../utils/demoHelper.js';
import {
  clearPersistedActivity,
  getIdleDurationMs,
  getPersistedIdleDurationMs,
  resetActivity,
} from '../utils/activityTracker.js';
import { withTimeout } from '../utils/supabaseTimeout.js';
import { isRepeatedSessionSignIn } from '../utils/authEvents.js';
import { useSessionKeepAlive } from '../hooks/useSessionKeepAlive.js';
import { useIdleLogout } from '../hooks/useIdleLogout.js';
import IdleWarningModal from '../components/idleWarningModal.jsx';
import {
  DEFAULT_REQUEST_TIMEOUT,
  IDLE_LOGOUT_TIMEOUT,
  IDLE_LOGOUT_WARN_BEFORE_MS,
  LOGOUT_REASON_KEY,
} from '../config/requestTimeouts.js';

const AuthContext = createContext();

/**
 * How long after a successful sign-in a SIGNED_OUT event is treated as teardown
 * left over from the session we just replaced, rather than a real sign-out.
 * See the comment in `login()` for why such events exist at all.
 */
const STALE_SIGNED_OUT_GRACE_MS = 10000;

/**
 * How long to wait for GoTrue's INITIAL_SESSION before giving up and letting
 * the app render unauthenticated. The event is emitted once the client has
 * finished loading and, where needed, refreshing the persisted session, so it
 * normally arrives in milliseconds — but the router now waits on this, and a
 * client wedged on a dead refresh token must not pin the app on a spinner.
 */
const AUTH_BOOTSTRAP_TIMEOUT_MS = 12000;

/**
 * How long the "is this stored token real?" call may take before the bootstrap
 * treats the server as unreachable. Comfortably inside the bootstrap window
 * above, so a slow verification resolves the router itself rather than being
 * cut off by the watchdog and leaving the session half-restored.
 */
const AUTH_VERIFY_TIMEOUT_MS = 8000;

/**
 * How long the profile load may take before the router stops waiting for it.
 * The load is several sequential queries and none of them is individually
 * bounded, so without this one stalled query holds the whole app.
 */
const AUTH_PROFILE_TIMEOUT_MS = 10000;

/**
 * How long the sign-out that throws away an unusable session may take. Short:
 * it runs at boot while GoTrue's lock is held, and the storage wipe that
 * follows is what actually retires the session — the call itself is a courtesy.
 */
const AUTH_DISCARD_TIMEOUT_MS = 4000;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const appBaseUrl =
    import.meta.env.VITE_APP_URL ||
    import.meta.env.VITE_SITE_URL ||
    (import.meta.env.PROD
      ? ''
      : (typeof window !== 'undefined' ? globalThis.location.origin : ''));
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  // The auth listener is mounted once, so React state in its closure is stale.
  // Keep the current token in a ref to identify Supabase's tab-focus replay.
  const activeAccessToken = useRef(null);
  const setActiveSession = useCallback((nextSession) => {
    activeAccessToken.current = nextSession?.access_token ?? null;
    setSession(nextSession);
  }, []);
  const isRefreshing = useRef(false);
  const lastVisibilityCheck = useRef(Date.now());
  // Timestamp of the most recent successful sign-in, plus a flag for sign-outs
  // we asked for ourselves. Together they let the SIGNED_OUT handler tell a real
  // sign-out from teardown belonging to the session we just replaced.
  const lastSignInAt = useRef(0);
  const intentionalSignOut = useRef(false);
  // Shared in-flight profile request — see fetchProfileOnce.
  const profileFetch = useRef(null);
  // Whether the auth bootstrap has reported back to the router, and the timer
  // that guarantees it eventually does. Refs, not closure variables, so
  // re-running the bootstrap effect cannot lose either one.
  const bootstrapSettled = useRef(false);
  const bootstrapWatchdog = useRef(null);
  // Whether GoTrue has emitted INITIAL_SESSION yet, and the session its startup
  // replay handed us before that. Together they separate "the client is
  // replaying what was in storage" from "someone just signed in" — see the
  // SIGNED_IN branch of onAuthStateChange.
  const initialSessionSeen = useRef(false);
  const replayedSession = useRef(null);

  const clearAuthState = useCallback(async () => {
    console.log('🧹 Clearing auth state and setting loading = false');
    setUser(null);
    setIsAuthenticated(false);
    setActiveSession(null);
    setLoading(false);
    resetSessionVerification();

    // Sign out from Supabase to clear any lingering session
    try {
      intentionalSignOut.current = true;
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error during sign out:', error);
    }
    // signOut() goes through the timeout-wrapped fetch and can abort midway,
    // leaving GoTrue half-signed-out with the token still persisted. Wiping
    // storage unconditionally is what makes the next load start clean.
    clearAuthStorage();
  }, [setActiveSession]);

  /**
   * Two bootstrap paths can ask for the same profile at once — an OAuth or
   * recovery callback emits SIGNED_IN while INITIAL_SESSION is still resolving.
   * Share the request instead of running it twice and letting the slower writer
   * overwrite the faster one.
   */
  const fetchProfileOnce = (userId) => {
    if (profileFetch.current && profileFetch.current.id === userId) {
      return profileFetch.current.promise;
    }
    const entry = { id: userId };
    entry.promise = (async () => {
      try {
        await fetchUserProfile(userId);
      } finally {
        if (profileFetch.current === entry) profileFetch.current = null;
      }
    })();
    profileFetch.current = entry;
    return entry.promise;
  };

  /**
   * Auth bootstrap.
   *
   * Restoration is driven by GoTrue's own INITIAL_SESSION event rather than a
   * one-off read at mount. The client emits it after it has loaded — and where
   * necessary refreshed — whatever was persisted, so it is the first moment at
   * which "is there a session" has a meaningful answer. Reading storage
   * ourselves would only tell us a token exists, which is not the same thing:
   * the restored session is therefore verified against the server with
   * getUser() before the app trusts it, and a token the server rejects is
   * removed rather than left to fail the same way on every reload.
   *
   * Every path resolves `loading`, because the router waits on it.
   */
  useEffect(() => {
    let mounted = true;

    /**
     * Release the router.
     *
     * Deliberately keyed on a ref rather than on this effect run's `mounted`
     * flag. AuthProvider is not unmounted when React re-runs the effect — which
     * StrictMode does on every mount in development — so a bootstrap that
     * finishes against the previous run still has a live component to report
     * to. Gating on `mounted` threw that answer away, and because the previous
     * run's watchdog was cleared at the same moment, a refresh could be left
     * with nothing at all able to lower the spinner. The ref makes settling
     * idempotent and unstealable.
     */
    const settle = () => {
      if (bootstrapWatchdog.current) {
        clearTimeout(bootstrapWatchdog.current);
        bootstrapWatchdog.current = null;
      }
      if (bootstrapSettled.current) return;
      bootstrapSettled.current = true;
      setLoading(false);
    };

    /**
     * Arm the last line of defence: if the bootstrap does not report back, render
     * unauthenticated rather than holding the app on a spinner for ever.
     */
    const armWatchdog = () => {
      if (bootstrapWatchdog.current) clearTimeout(bootstrapWatchdog.current);
      bootstrapWatchdog.current = setTimeout(() => {
        bootstrapWatchdog.current = null;
        if (bootstrapSettled.current) return;
        console.warn('⚠️ Auth bootstrap did not report back in time; continuing unauthenticated');
        settle();
      }, AUTH_BOOTSTRAP_TIMEOUT_MS);
    };

    /**
     * Put the app back on the spinner, with a fresh watchdog behind it.
     *
     * Anything that raises `loading` again after the first bootstrap has to come
     * through here. GoTrue emits SIGNED_IN during startup whenever it renews an
     * expired access token, and that handler used to raise `loading` on its own:
     * the original watchdog had already been spent, so the only thing left that
     * could lower it was the profile fetch — six sequential queries, none of them
     * bounded. One stalled query and the tab spun for ever. That is the hang.
     */
    const beginBootstrap = () => {
      bootstrapSettled.current = false;
      setLoading(true);
      armWatchdog();
    };

    // Demo mode never touches GoTrue. Set it up before subscribing, but still
    // subscribe, so signing in for real from a demo session is observed.
    if (isDemoMode()) {
      console.log('🧪 Demo mode detected');
      setUser(MOCK_USER);
      setIsAuthenticated(true);

      try {
        if (DEMO_CONFIG && DEMO_CONFIG.enableRandomFaces) {
          // Fire-and-forget: populates the photo cache for later reads.
          attachSeededRandomUserPhotos(getDemoEmployees())
            .then(() => console.log('📸 Prefetched seeded demo photos'))
            .catch((err) => console.warn('Failed to prefetch seeded demo photos', err));
        }
      } catch (err) {
        console.warn('Error during demo photo prefetch setup', err);
      }

      settle();
    }

    /**
     * Throw away a persisted session the server will not honour. Without this
     * the same dead token is re-read on every load and fails identically each
     * time, with no path back to a clean state but clearing site data by hand.
     *
     * `scope` matters more here than anywhere else in the file. A default
     * (global) signOut is a network round-trip to /logout, and GoTrue holds its
     * Web Lock for the whole call — during boot, with the login form the very
     * next thing the user touches. login() then waits on getSession() behind
     * that same lock, which is the "credentials accepted, nothing happens, have
     * to hard-refresh" failure logout() already had to be rewritten to avoid.
     * A rejected token is rare enough to pay for revocation; the idle path is
     * the common one and passes 'local', where there is nothing to revoke —
     * the point is only to stop this client reusing the token.
     *
     * Bounded either way, so a wedged auth lock cannot hold the app on the
     * spinner until the bootstrap watchdog trips. The storage wipe below is
     * what actually guarantees the session is gone, and it always runs.
     */
    const discardRestoredSession = async (reason, error, { scope } = {}) => {
      console.warn(`🧹 Discarding restored session — ${reason}`, error || '');
      try {
        intentionalSignOut.current = true;
        await withTimeout(
          scope ? supabase.auth.signOut({ scope }) : supabase.auth.signOut(),
          AUTH_DISCARD_TIMEOUT_MS
        );
      } catch (signOutError) {
        // Expected when the network is the reason we got here; storage still
        // has to go, which is what clearAuthStorage() is for.
        console.warn('signOut while discarding failed; clearing storage anyway', signOutError);
      }
      clearAuthStorage();
      resetSessionVerification();
      if (!mounted) return;
      setUser(null);
      setIsAuthenticated(false);
      setActiveSession(null);
    };

    const restoreSession = async (initialSession) => {
      if (!initialSession) {
        console.log('✅ No session to restore');
        settle();
        return;
      }

      /*
       * A restored session is only as good as the idle rule that governs it.
       *
       * useIdleLogout can only expire a tab that stays open, so on its own it
       * left the main case unhandled: close the app, come back tomorrow, and
       * the persisted token was restored and verified exactly as if no time had
       * passed. That is the automatic sign-in after an idle period. The stamp
       * now survives reloads and closed tabs, so the same rule can be applied
       * here — before the session is trusted, and before any network call.
       *
       * No stamp at all is "unknown", not "idle": a store cleared by hand, or
       * the first load after this shipped. Signing someone out on absence of
       * evidence is the mistake this file avoids everywhere else, so stamp the
       * moment instead and let the normal rule take over from here.
       */
      const persistedIdleMs = getPersistedIdleDurationMs();
      if (persistedIdleMs === null) {
        resetActivity();
      } else if (persistedIdleMs >= IDLE_LOGOUT_TIMEOUT) {
        console.warn(
          `🚪 Session idle for ~${Math.round(persistedIdleMs / 60000)} min — signing out instead of restoring`
        );
        try {
          sessionStorage.setItem(LOGOUT_REASON_KEY, 'idle');
        } catch {
          // The notice is cosmetic; the sign-out below is not.
        }
        // Local scope: see discardRestoredSession. This is the hot path now, and
        // it runs immediately before someone signs in again.
        await discardRestoredSession(
          'the idle timeout elapsed while the app was away',
          null,
          { scope: 'local' }
        );
        clearPersistedActivity();
        settle();
        return;
      }

      // The session came out of storage. Ask the server whether it is real.
      //
      // Bounded, because this call is the app's gate: GoTrue serialises auth
      // requests behind a Web Lock, so one stuck refresh holds every later
      // caller — including this one — for as long as the transport allows, and
      // the router waits the whole time. A timeout here is not a verdict on the
      // session, it is the same "could not reach the server" answer as a
      // transport failure, and is handled as such below.
      let verifiedUser = null;
      let error = null;
      try {
        const result = await withTimeout(supabase.auth.getUser(), AUTH_VERIFY_TIMEOUT_MS);
        verifiedUser = result.data?.user ?? null;
        error = result.error ?? null;
      } catch (thrown) {
        // A throw here is the transport failing, not a verdict on the session.
        error = thrown;
      }
      // No `mounted` check: React may have re-run this effect (StrictMode does,
      // every time), and abandoning the bootstrap here is what used to strand
      // the router. The component is still alive; the writes below are
      // idempotent, and on a genuine unmount React discards them anyway.

      if (error && !isRejectedByServer(error)) {
        /*
         * Unreachable server proves nothing — and this branch used to act as
         * though it did. It kept the token, said so in a comment, then settled
         * with `isAuthenticated` still false, which drops the router onto
         * <Navigate to="/login" replace> and destroys the URL the user
         * refreshed from. A timed-out getUser() is not a verdict; carry on with
         * the local token, exactly as validateAndRefreshSession() does when it
         * returns `unverified`. The next call that needs certainty will ask
         * again, and a genuinely dead token fails there instead of here.
         */
        console.warn('⚠️ Could not verify the restored session; continuing on the stored token', error);
      } else if (error || !verifiedUser) {
        await discardRestoredSession('the server rejected the stored token', error);
        settle();
        return;
      } else {
        markSessionVerified();
      }

      /*
       * Falling back to the stored session's user id, guarded: when the client
       * cannot produce a real user object it substitutes a proxy that *throws*
       * on property access (auth-js `userNotAvailableProxy`). An exception here
       * escapes into GoTrue's subscriber loop and never reaches settle(),
       * leaving the app on the spinner until the watchdog trips.
       */
      let profileUserId = verifiedUser?.id ?? null;
      if (!profileUserId) {
        try {
          profileUserId = initialSession.user?.id ?? null;
        } catch {
          profileUserId = null;
        }
      }

      if (!profileUserId) {
        console.warn('⚠️ Restored session has no usable user id; leaving the token for the next load');
        settle();
        return;
      }

      disableDemoMode();
      console.log('✅ Restored session accepted, loading profile...');
      setActiveSession(initialSession);
      try {
        await withTimeout(fetchProfileOnce(profileUserId), AUTH_PROFILE_TIMEOUT_MS);
      } catch (profileError) {
        // A timeout does not cancel the underlying queries: if the profile
        // arrives late it still sets the user and the app moves off the login
        // screen by itself. What matters here is that the router stops waiting.
        console.error('Error loading profile during restore:', profileError);
      } finally {
        settle();
      }
    };

    // React to the session lifecycle, not to a single read at startup.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;

      console.log('🔔 Auth event:', event);

      if (event === 'INITIAL_SESSION') {
        initialSessionSeen.current = true;
        // A demo session has already been established above and owns the state.
        if (isDemoMode()) {
          replayedSession.current = null;
          settle();
          return;
        }
        /*
         * `_emitInitialSession` reports whatever `_useSession` could load, and
         * emits null if that throws. Falling back to the session the startup
         * replay already handed us keeps a transient storage read from looking
         * like a sign-out. Anything that genuinely retired the session came
         * through SIGNED_OUT, which clears this.
         */
        const bootSession = nextSession ?? replayedSession.current;
        replayedSession.current = null;
        await restoreSession(bootSession);
      } else if (event === 'SIGNED_IN' && nextSession) {
        /*
         * Not necessarily a sign-in.
         *
         * GoTrue's `_recoverAndRefresh()` emits SIGNED_IN for a valid stored
         * token both at startup and whenever a hidden tab becomes visible. It is
         * replaying persisted state, not necessarily reporting a new login.
         *
         * INITIAL_SESSION is guaranteed to follow (the emitter awaits the same
         * promise), so let it own the restore and just remember the session.
         *
         * At startup the discriminator is ordering: nothing from a real sign-in
         * can precede INITIAL_SESSION, because initialization has long since
         * resolved by then.
         */
        if (!initialSessionSeen.current) {
          console.log('🔁 Startup session replay — deferring to INITIAL_SESSION');
          replayedSession.current = nextSession;
          return;
        }

        // A foreground recovery with the token already in use must not raise
        // the global auth spinner or reload the profile. Supabase can emit this
        // after even a one-second tab switch.
        if (isRepeatedSessionSignIn(activeAccessToken.current, nextSession)) {
          console.log('🔁 Existing session re-confirmed — keeping current profile');
          return;
        }

        console.log('🔐 User signed in');
        // Clear demo mode when a real user signs in
        disableDemoMode();
        // This session came from the server — signInWithPassword, or an OAuth
        // callback — so it needs no verification. (The startup replay above
        // reaches none of this: that session came out of storage, and calling
        // markSessionVerified() on it would have vouched for a token nobody
        // had checked.)
        markSessionVerified();

        setActiveSession(nextSession);
        beginBootstrap();

        try {
          // Fetch profile immediately
          await withTimeout(fetchProfileOnce(nextSession.user.id), AUTH_PROFILE_TIMEOUT_MS);
          setIsAuthenticated(true);
        } catch (error) {
          console.error('Error loading profile after sign in:', error);
        } finally {
          settle();
        }
      } else if (event === 'SIGNED_OUT') {
        // GoTrue emits SIGNED_OUT from _removeSession(), which several teardown
        // paths reach on their own schedule — a slow signOut() and a
        // _recoverAndRefresh() that gives up on a dead refresh token both land
        // here. Either can fire *after* a newer sign-in has already saved its
        // session, and honouring it silently undoes that sign-in.
        if (
          !intentionalSignOut.current &&
          Date.now() - lastSignInAt.current < STALE_SIGNED_OUT_GRACE_MS
        ) {
          console.warn('🚪 Ignoring SIGNED_OUT from the session that was just replaced');
          return;
        }
        console.log('🚪 User signed out');
        intentionalSignOut.current = false;
        // Whatever the startup replay was holding is retired with the session,
        // so INITIAL_SESSION cannot fall back onto it.
        replayedSession.current = null;
        resetSessionVerification();
        setUser(null);
        setIsAuthenticated(false);
        setActiveSession(null);
        bootstrapSettled.current = false;
        settle();
      } else if (event === 'TOKEN_REFRESHED' && nextSession) {
        console.log('🔄 Token refreshed');
        setActiveSession(nextSession);
        // The refresh token survived a round-trip — that is a server-side proof
        // of validity, so the next fetch need not repeat it.
        markSessionVerified();
        // Don't reload profile, just update session
      } else if (event === 'PASSWORD_RECOVERY') {
        // Emitted when detectSessionInUrl consumes a recovery link. The reset
        // screen drives the rest; all that is needed here is to stop waiting.
        console.log('🔑 Password recovery session detected');
        if (nextSession) setActiveSession(nextSession);
        settle();
      } else if (event === 'USER_UPDATED' && nextSession) {
        console.log('👤 User updated');
        // Check if this is a password change - if so, skip profile reload
        // Password changes don't affect user metadata, so no need to reload
        const isPasswordChange = localStorage.getItem('changingPassword') === 'true';
        if (isPasswordChange) {
          console.log('⏭️ Skipping profile reload for password change');
        } else {
          console.log('🔄 Reloading profile for user update');
          await fetchProfileOnce(nextSession.user.id);
        }
      }
    });

    // Cover the first bootstrap — no INITIAL_SESSION, or a call wedged behind
    // GoTrue's lock. Every later return to the spinner arms its own through
    // beginBootstrap(), so the router is never waiting on nothing.
    if (!bootstrapSettled.current) armWatchdog();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      // The watchdog deliberately outlives this cleanup. React re-runs the
      // effect on every StrictMode mount, and disarming a timer that belongs to
      // a bootstrap still in flight is how the guarantee got lost. `settle` is
      // idempotent and React drops a state write to an unmounted tree.
    };
  }, [setActiveSession]);

  // Handle visibility change (when user returns from power saving mode / idle)
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Skip session check if in demo mode or user is not signed in
      if (isDemoMode()) {
        console.log('🧪 Demo mode active - skipping session check');
        return;
      }
      if (!isAuthenticated) {
        return;
      }

      if (document.visibilityState === 'visible') {
        // Past the idle window there is nothing here worth renewing: useIdleLogout
        // is about to end this session, and refreshing the token first only races
        // that logout and puts a fresh token in storage on the way out.
        if (getIdleDurationMs() >= IDLE_LOGOUT_TIMEOUT) {
          console.log('⏭️ Skipping session refresh - past the idle timeout');
          return;
        }

        const now = Date.now();
        const timeSinceLastCheck = now - lastVisibilityCheck.current;
        if (timeSinceLastCheck < 60000) {
          console.log('⏭️ Skipping session refresh - checked recently');
          return;
        }
        
        lastVisibilityCheck.current = now;
        
        // Prevent concurrent refresh attempts
        if (isRefreshing.current) {
          console.log('⏭️ Session refresh already in progress');
          return;
        }
        
        console.log('👁️ Page became visible - checking session...');
        isRefreshing.current = true;
        
        try {
          // Try to get current session
          const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error('Session check error:', sessionError);
            // Don't clear auth state immediately - try to refresh first
          }
          
          if (currentSession) {
            // Check if token needs refresh (expired or will expire soon)
            const expiresAt = currentSession.expires_at;
            const now = Math.floor(Date.now() / 1000);
            const expiresInSeconds = expiresAt - now;
            
            console.log(`🔐 Session expires in ${expiresInSeconds} seconds`);
            
            // If token expires in less than 5 minutes, try to refresh via centralized helper
            if (expiresInSeconds < 300) {
              console.log('🔄 Token expiring soon - refreshing session via helper...');
              const refreshResult = await validateAndRefreshSession();

              if (!refreshResult.success) {
                console.error('Session refresh failed (helper):', refreshResult.error || refreshResult.warning);
                // Session is invalid - need to re-login
                await clearAuthState();
                return;
              }

              console.log('✅ Session refreshed successfully (helper)');
              // Update session from supabase client
              const { data: { session: updatedSession } } = await supabase.auth.getSession();
              if (updatedSession) setActiveSession(updatedSession);
            } else {
              // Session is still valid
              console.log('✅ Session is still valid');
              setActiveSession(currentSession);
            }
            
            // Verify the user is still valid
            const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

            if (userError || !currentUser) {
              // A tab waking up on a dead connection is the common case here.
              // Failing to reach the server says nothing about the session, and
              // tearing down on it would sign people out for changing networks.
              if (!isRejectedByServer(userError)) {
                console.warn('⚠️ Could not verify the user after visibility change; leaving the session alone', userError);
                return;
              }
              console.warn('User verification failed after visibility change:', userError);
              const retryRefresh = await validateAndRefreshSession({ forceVerify: true });
              if (!retryRefresh.success && isAuthenticated) {
                await clearAuthState();
              }
              return;
            }

            markSessionVerified();

            // If we don't have user data in state, reload the profile
            if (!user) {
              console.log('🔄 User state empty - reloading profile...');
              await fetchProfileOnce(currentUser.id);
            }
          } else {
            // No session in memory — try one recovery refresh before signing out
            console.log('⚠️ No session found after visibility change — attempting recovery');
            const refreshResult = await validateAndRefreshSession({ quiet: true });
            if (refreshResult.success) {
              const { data: { session: recovered } } = await supabase.auth.getSession();
              if (recovered) {
                setActiveSession(recovered);
                console.log('✅ Session recovered after visibility change');
                return;
              }
            }
            await clearAuthState();
          }
        } catch (error) {
          console.error('Error during visibility change session check:', error);
        } finally {
          isRefreshing.current = false;
        }
      }
    };

    // Handle online/offline events
    const handleOnline = () => {
      console.log('🌐 Network came online - checking session...');
      // Trigger a visibility check when coming back online
      lastVisibilityCheck.current = 0; // Reset to force check
      handleVisibilityChange();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    globalThis.addEventListener('online', handleOnline);
    
    // Also handle focus events for additional reliability
    const handleFocus = () => {
      // Debounce focus events
      const now = Date.now();
      if (now - lastVisibilityCheck.current > 60000) { // 1 minute debounce for focus
        handleVisibilityChange();
      }
    };
    globalThis.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      globalThis.removeEventListener('online', handleOnline);
      globalThis.removeEventListener('focus', handleFocus);
    };
  }, [isAuthenticated, user, setActiveSession, clearAuthState]);

  // Fetch user profile with role from database
  const fetchUserProfile = async (userId) => {
    let shouldCreateProfile = false;
    
    try {
      console.log('Fetching user profile for auth ID:', userId);
      
      // First, try to resolve the auth_user_id to hr_user_id using user_emails table
      const { data: emailDataArray, error: emailError } = await supabase
        .from('user_emails')
        .select('hr_user_id')
        .eq('auth_user_id', userId)
        .limit(1);
      
      if (emailError) {
        console.error('Error checking user_emails:', emailError);
      }
      
      // Get the first result if exists
      const emailData = emailDataArray && emailDataArray.length > 0 ? emailDataArray[0] : null;
      
      // Use the resolved hr_user_id if found, otherwise use the auth userId directly (backward compatibility)
      const hrUserId = emailData?.hr_user_id || userId;
      
      if (emailData?.hr_user_id) {
        console.log(`✅ Resolved auth ID ${userId} to hr_user ID ${hrUserId}`);
      } else {
        console.log('⚠️ No email mapping found, using auth ID directly (backward compatibility)');
      }
      
      /*
       * These two do not depend on each other — only both on hrUserId — and
       * running them in sequence put another full round-trip in front of the
       * first paint. The whole chain is on the critical path for rendering the
       * app, so every serialized hop here is spinner the user sits through.
       */
      const [
        { data, error },
        { data: userEmails },
      ] = await Promise.all([
        supabase.from('hr_users').select('*').eq('id', hrUserId).single(),
        supabase.from('user_emails').select('email').eq('hr_user_id', hrUserId),
      ]);

      // If no record found, mark for creation
      if (!data && !error) {
        shouldCreateProfile = true;
      }

      // Build array of emails to search for a matching employee record
      const emailsToSearch = [];
      if (data && data.email && !error) {
        // Split hr_users.email in case it has semicolon-separated emails
        const hrUserEmails = data.email.split(';').map(e => e.trim()).filter(e => e);
        emailsToSearch.push(...hrUserEmails);

        // Add all emails from user_emails table
        if (userEmails && userEmails.length > 0) {
          userEmails.forEach(ue => {
            if (!emailsToSearch.includes(ue.email)) {
              emailsToSearch.push(ue.email);
            }
          });
        }
      }

      /*
       * The employee match and the manager lookup both depend on the hr_users
       * row and not on each other, so they go together rather than one after
       * the other.
       *
       * The "sample employees" query that used to run whenever no match was
       * found has gone with them. It fetched ten unrelated rows purely to print
       * them, on the critical path, for every user who has no employee record —
       * paying a round-trip of first-paint latency for a debug aid.
       */
      const [employeeResult, managerResult] = await Promise.all([
        emailsToSearch.length > 0
          ? supabase.from('employees').select('name, id, email').in('email', emailsToSearch).limit(1)
          : Promise.resolve({ data: null }),
        data && data.manager_id && !error
          ? supabase
              .from('hr_users')
              .select('id, full_name, email, position')
              .eq('id', data.manager_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const employeeData = employeeResult.data;
      if (data && employeeData && employeeData.length > 0 && employeeData[0].name) {
        console.log(`✅ Found employee: ${employeeData[0].name} (${employeeData[0].email})`);
        data.employee_name = employeeData[0].name;
        data.employee_id = employeeData[0].id;
      } else if (emailsToSearch.length > 0) {
        console.log('⚠️ No employee found for emails:', emailsToSearch);
      }

      if (data && managerResult.data) {
        data.manager = managerResult.data;
      }

      if (error) {
        console.error('Database error:', error);
        
        // Mark that we should create profile if user not found
        if (error.code === 'PGRST116') {
          shouldCreateProfile = true;
        } else {
          throw error;
        }
      }

      if (data && data.is_active) {
        // Additional check: verify employment_status is not 'terminated'
        if (data.employment_status === 'terminated' || data.employment_status === 'inactive') {
          console.warn(`User account has employment_status: ${data.employment_status} - denying access`);
          await supabase.auth.signOut();
          setUser(null);
          setIsAuthenticated(false);
          setActiveSession(null);
          setLoading(false);
          return;
        }
        
        console.log('User profile found:', data);
        
        // Employee data is already fetched above, just use it
        const employeeId = data.employee_id;
        const employeeName = data.employee_name;
        
        console.log(`👤 Name selection: employeeName="${employeeName}" | full_name="${data.full_name}" | first_name="${data.first_name}"`);
        
        // Update last_login timestamp. Fire-and-forget: nothing on screen reads
        // it, and awaiting a write held the first paint behind a round-trip.
        supabase
          .from('hr_users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', hrUserId)
          .then(({ error: lastLoginError }) => {
            if (lastLoginError) {
              console.warn('Could not record last_login:', lastLoginError.message);
            }
          });


        setUser({
          id: data.id,
          email: data.email,
          name: employeeName || data.full_name || data.first_name || data.email.split('@')[0],
          firstName: data.first_name,
          lastName: data.last_name,
          phone: data.phone,
          role: data.role,
          avatar_url: data.avatar_url,
          department: data.department,
          position: data.position,
          employeeId: employeeId,
          managerId: data.manager_id,
          manager: data.manager,
          hireDate: data.hire_date,
          employmentStatus: data.employment_status,
          salary: data.salary,
          permissions: hasPermission(data.role)
        });
        setIsAuthenticated(true);
        console.log('✅ Profile loaded successfully, setting loading = false');
        setLoading(false);
      } else if (shouldCreateProfile) {
        console.log('User not found, attempting to create profile...');
        await createUserProfile(userId);
      } else if (data && !data.is_active) {
        console.warn('User account is inactive (is_active = false)');
        await clearAuthState();
      } else {
        console.warn('No user data found and cannot create profile');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // On error, clear auth state to force re-login (includes setLoading(false))
      await clearAuthState();
    }
  };

  // Create user profile if it doesn't exist
  const createUserProfile = async (userId) => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      
      // Extract name components from user metadata or email
      const userMetadata = authData.user.user_metadata || {};
      const fullName = userMetadata.full_name || userMetadata.name;
      let firstName = userMetadata.first_name || fullName?.split(' ')[0];
      let lastName = userMetadata.last_name || fullName?.split(' ').slice(1).join(' ');
      
      // CRITICAL: Check if there's an existing employee with this email
      const { data: existingEmployee } = await supabase
        .from('employees')
        .select('id, name, position, department, email')
        .eq('email', authData.user.email)
        .maybeSingle();
      
      let employeeId = null;
      let employeeName = null;
      let position = null;
      let department = null;
      
      if (existingEmployee) {
        console.log(`Found existing employee record for ${authData.user.email}:`, existingEmployee);
        employeeId = existingEmployee.id;
        employeeName = existingEmployee.name;
        position = existingEmployee.position;
        department = existingEmployee.department;
        
        // Extract first and last name from employee name if not provided
        if (!firstName && employeeName) {
          const nameParts = employeeName.split(' ');
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        }
      } else {
        console.log(`No existing employee found for ${authData.user.email}, creating standalone user`);
      }
      
      const { error } = await supabase
        .from('hr_users')
        .insert([
          {
            id: userId,
            email: authData.user.email,
            first_name: firstName || authData.user.email.split('@')[0],
            last_name: lastName || null,
            avatar_url: userMetadata.avatar_url || null,
            role: position === 'general_manager' ? 'admin' : 
                  position === 'hr_specialist' ? 'manager' : 'employee',
            employment_status: 'active',
            employee_id: employeeId, // Link to existing employee if found
            position: position,
            department: department,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) throw error;
      
      console.log(`User profile created successfully${employeeId ? ' and linked to employee ' + employeeId : ''}`);
      // Fetch the newly created profile
      await fetchUserProfile(userId);
    } catch (error) {
      console.error('Error creating user profile:', error);
      setLoading(false);
    }
  };

  // Email/Password login
  const login = async (email, password, rememberMe = true) => {
    try {
      console.log(`🔐 Logging in with email: ${email}, rememberMe: ${rememberMe}`);

      // A forced logout queued by a page whose fetch failed during the idle
      // period must not fire in the middle of this sign-in — it would wipe
      // storage and take the auth lock underneath us.
      cancelScheduledLogout();

      // Retire whatever session is already persisted before signing in.
      //
      // This used to race `signOut({ scope: 'local' })` against a 2.5s timeout.
      // That was the bug behind "I have to try to log in, then hard-refresh":
      // signOut() awaits the client's initializePromise before it does anything,
      // and a stale persisted token is exactly what makes that promise slow —
      // the client is still round-tripping a dead refresh token. So the 2.5s
      // elapsed, login continued, and the signOut kept running orphaned. It then
      // reached _removeSession() *after* signInWithPassword had saved the new
      // session, deleting that session from storage and emitting SIGNED_OUT.
      // Credentials were accepted and the login was then thrown away. With no
      // persisted token — a private window, or after manually clearing it —
      // initialize() returns immediately, signOut finishes inside the 2.5s, and
      // sign-in worked. Hence the three workarounds.
      //
      // Instead: let the client finish booting first, so any teardown it decides
      // on lands before the new session exists rather than on top of it. Bounded
      // so a hung boot cannot pin the login form indefinitely; the SIGNED_OUT
      // guard in onAuthStateChange backstops that case. getSession() awaits the
      // same initializePromise signOut() would have.
      try {
        supabase.auth.stopAutoRefresh?.();
        await Promise.race([
          supabase.auth.getSession().catch(() => null),
          new Promise((resolve) => setTimeout(resolve, DEFAULT_REQUEST_TIMEOUT + 2000)),
        ]);
        // Synchronous and lock-free, so it cannot be left in flight.
        clearAuthStorage();
      } catch (prepError) {
        console.warn('Pre-login session clear:', prepError?.message || prepError);
      }

      // Set storage type based on rememberMe checkbox
      if (typeof window !== 'undefined') {
        if (rememberMe) {
          customStorage.setStorage(globalThis.localStorage);
          console.log('✅ Using localStorage (persistent session)');
        } else {
          customStorage.setStorage(globalThis.sessionStorage);
          console.log('✅ Using sessionStorage (session-only)');
        }
      }

      // Guard helper: never let a single auth-related request hang the login UI.
      // Bounds the call and surfaces a clear, retryable error instead of freezing.
      const withLoginTimeout = (promise, ms, label) =>
        Promise.race([
          promise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out. Please check your connection and try again.`)), ms)
          ),
        ]);

      // Always login with the provided email (authenticate the actual auth user).
      //
      // The budget must stay comfortably above DEFAULT_REQUEST_TIMEOUT. GoTrue
      // serializes auth calls behind a Web Lock, so a background token refresh
      // that stalled while the tab was idle holds the lock until that timeout
      // aborts it. With a shorter budget here, sign-in reported failure before
      // the blocker was even released — which is why logging back in after an
      // idle period appeared to need a hard refresh.
      const { data, error } = await withLoginTimeout(
        supabase.auth.signInWithPassword({
          email: email,
          password
        }),
        DEFAULT_REQUEST_TIMEOUT + 15000,
        'Sign in'
      );

      if (error) throw error;

      // Stamp before anything else awaits: from here on, a SIGNED_OUT belongs to
      // the session we just replaced unless we asked for it ourselves.
      lastSignInAt.current = Date.now();
      intentionalSignOut.current = false;
      // Start this session's idle clock now. Without it the session inherits
      // whatever stamp the store still held, and a sign-in that follows a long
      // absence would be measured as though it had already been idle.
      resetActivity();

      console.log('✅ Login successful');
      try {
        supabase.auth.startAutoRefresh?.();
      } catch {
        // ignore
      }

      // Check if this email has a mapping to a different HR user.
      // Runs after sign-in: it never affected which credentials were used, and
      // in front of sign-in it added a PostgREST round trip that itself waits on
      // the auth lock. Best-effort — a failure just falls through to the normal
      // profile load.
      console.log('🔍 Checking email mapping in user_emails...');
      let emailMapping = null;
      try {
        const { data: mappingData } = await withLoginTimeout(
          supabase
            .from('user_emails')
            .select('email, hr_user_id, auth_user_id')
            .eq('email', email)
            .maybeSingle(),
          8000,
          'Account lookup'
        );
        emailMapping = mappingData || null;
      } catch (mappingLookupError) {
        console.warn('⚠️ Email mapping lookup skipped:', mappingLookupError?.message || mappingLookupError);
      }

      // If this email is mapped to a different HR user, we need to load that profile instead
      if (emailMapping && emailMapping.hr_user_id) {
        console.log(`🔗 Email mapping found: auth user ${data.user.id} → HR user ${emailMapping.hr_user_id}`);
        
        // Check if the logged-in auth user matches the expected auth_user_id
        if (data.user.id !== emailMapping.auth_user_id) {
          console.log(`⚠️ Auth user mismatch: logged in as ${data.user.id}, but user_emails expects ${emailMapping.auth_user_id}`);
          console.log(`📝 Will load HR profile for: ${emailMapping.hr_user_id}`);
        }
        
        // Manually fetch the HR user profile using the mapped hr_user_id
        // This allows multiple auth users to map to the same HR profile
        try {
          console.log(`📝 Loading full HR profile for: ${emailMapping.hr_user_id}`);
          await fetchUserProfile(emailMapping.hr_user_id);
          return { success: true };
        } catch (profileError) {
          console.error('Error loading mapped profile:', profileError);
          // Fall through to normal profile loading
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  // GitHub OAuth login
  const loginWithGithub = async () => {
    try {
      // CRITICAL: Ensure we use localStorage for OAuth so session persists after redirect
      console.log('🔐 GitHub OAuth: Setting storage to localStorage for session persistence');
      customStorage.setStorage(localStorage);
      
      const { _data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: `${globalThis.location.origin}/time-clock`,
          skipBrowserRedirect: false
        }
      });

      if (error) throw error;

      // OAuth will redirect the browser, so we don't need to do anything else
      // The success is about initiating the OAuth flow, not completing it
      console.log('✅ GitHub OAuth flow initiated successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ GitHub login error:', error);
      
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.message?.includes('popup')) {
        errorMessage = 'Please allow popups for this site to login with GitHub';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection and try again';
      } else if (error.message?.includes('not enabled')) {
        errorMessage = 'GitHub login is not enabled. Please contact your administrator.';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Forgot password - send reset email
  const forgotPassword = async (email) => {
    try {
      console.log('📧 Sending password reset email to:', email);

      if (!appBaseUrl) {
        throw new Error('Missing app base URL for reset link. Set VITE_APP_URL or VITE_SITE_URL.');
      }

      const redirectTo = `${appBaseUrl}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) throw error;

      console.log('✅ Password reset email sent successfully');
      return {
        success: true,
        message: 'Password reset email sent. Please check your inbox.',
        t: 'login.forgotPasswordModal.success'
      };
    } catch (error) {
      console.error('❌ Forgot password error:', error);
      
      let errorMessage = error.message;
      if (error.message?.includes('User not found')) {
        errorMessage = 'No account found with this email address';
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Too many requests. Please try again later';
      } else if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your connection';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  // Reset password with token (called on reset-password page)
  const resetPassword = async (newPassword) => {
    try {
      console.log('🔐 Resetting password...');
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      console.log('✅ Password reset successfully');
      return { success: true, message: 'Password reset successfully. You can now login with your new password.' };
    } catch (error) {
      console.error('❌ Reset password error:', error);
      
      let errorMessage = error.message;
      if (error.message?.includes('same as the old password')) {
        errorMessage = 'New password must be different from the old password';
      } else if (error.message?.includes('weak')) {
        errorMessage = 'Password is too weak. Please use a stronger password';
      }
      
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logging out...');
      
      if (isDemoMode()) {
        disableDemoMode();
        setUser(null);
        setIsAuthenticated(false);
        setActiveSession(null);
        setLoading(false);
        console.log('✅ Demo mode disabled');
        return;
      }

      // Mark this as a sign-out we asked for, so the SIGNED_OUT handler does not
      // mistake it for teardown of a replaced session and ignore it.
      intentionalSignOut.current = true;

      // Stop background refresh so it cannot keep holding the GoTrue lock
      try {
        supabase.auth.stopAutoRefresh?.();
      } catch {
        // ignore
      }

      // Clear state immediately so UI can move on even if signOut hangs
      setUser(null);
      setIsAuthenticated(false);
      setActiveSession(null);
      setLoading(false);
      // Whatever the server last confirmed no longer applies to anyone.
      resetSessionVerification();

      // Mirror contract app: wipe persisted tokens before signOut
      clearAuthStorage();
      // The idle clock belongs to the session that just ended, not to whoever
      // signs in next.
      clearPersistedActivity();

      // Local scope clears in-memory session without a network round-trip.
      // A timed-out *global* signOut was leaving GoTrue locked so re-login
      // failed until a hard refresh remounted the client.
      try {
        const { error } = await Promise.race([
          supabase.auth.signOut({ scope: 'local' }),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Sign out timeout')), 3000);
          }),
        ]);
        if (error && error.message !== 'Auth session missing!') {
          console.error('Logout error:', error);
        }
      } catch (error) {
        console.error('Logout error:', error);
        clearAuthStorage();
      }

      console.log('✅ Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Force clear state even on error
      clearAuthStorage();
      setUser(null);
      setIsAuthenticated(false);
      setActiveSession(null);
      setLoading(false);
    }
  };

  // Check if user has specific permission - memoized
  const checkPermission = useCallback((permission) => {
    if (!user || !user.role) return false;
    // In demo mode, admin has all permissions
    if (isDemoMode() && user.role === 'admin') return true;
    return hasPermission(user.role, permission);
  }, [user]);

  // Demo-only: switch between demo_admin and demo_employee roles - memoized
  const switchDemoRole = useCallback((nextRole) => {
    if (!isDemoMode()) return;
    if (nextRole !== 'demo_admin' && nextRole !== 'demo_employee') return;

    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        role: nextRole,
        permissions: Permissions[nextRole] || prev.permissions
      };
    });
  }, []);

  const loginAsDemo = useCallback(() => {
    // Do NOT auto-reset demo data on login - let user manually restore via Control Panel
    // Users can use the "Restore Demo Data" feature in Control Panel to reset specific data types

    enableDemoMode();
    setUser(MOCK_USER);
    setIsAuthenticated(true);
    setLoading(false);
  }, []);

  // The auth actions above are plain functions, so each render gives them a new
  // identity. Exposed directly, that defeated the context-value memo below —
  // every `useAuth()` consumer re-rendered on every provider render, and the
  // changing `logout` identity rippled into `handleSessionAuthError` and from
  // there into each page's data-fetch callbacks, restarting in-flight requests.
  // Wrapping them in stable delegates keeps identities fixed while each call
  // still runs against the latest closure.
  const authActionsRef = useRef(null);
  authActionsRef.current = { login, loginWithGithub, forgotPassword, resetPassword, logout };

  const stableLogin = useCallback((...args) => authActionsRef.current.login(...args), []);
  const stableLoginWithGithub = useCallback((...args) => authActionsRef.current.loginWithGithub(...args), []);
  const stableForgotPassword = useCallback((...args) => authActionsRef.current.forgotPassword(...args), []);
  const stableResetPassword = useCallback((...args) => authActionsRef.current.resetPassword(...args), []);
  const stableLogout = useCallback((...args) => authActionsRef.current.logout(...args), []);

  const sessionHooksEnabled = isAuthenticated && !isDemoMode();
  useSessionKeepAlive({ enabled: sessionHooksEnabled });

  const [idleWarningOpen, setIdleWarningOpen] = useState(false);

  const idleLogoutInProgressRef = useRef(false);
  const handleIdleLogout = useCallback(async () => {
    if (idleLogoutInProgressRef.current) return;
    idleLogoutInProgressRef.current = true;
    setIdleWarningOpen(false);
    try {
      sessionStorage.setItem(LOGOUT_REASON_KEY, 'idle');
      await authActionsRef.current?.logout?.();
    } finally {
      idleLogoutInProgressRef.current = false;
    }
  }, []);

  const handleIdleWarning = useCallback(({ remainingMs }) => {
    console.warn(`Session will end in ~${Math.round(remainingMs / 1000)}s due to inactivity.`);
    setIdleWarningOpen(true);
  }, []);

  // Any genuine interaction anywhere in the app clears the warning through the
  // activity tracker, so the countdown never outlives the idleness it reports.
  const handleIdleWarningCleared = useCallback(() => {
    setIdleWarningOpen(false);
  }, []);

  const handleStaySignedIn = useCallback(async () => {
    setIdleWarningOpen(false);
    resetActivity();
    /*
     * Extending the idle clock without renewing the token is how the stale-token
     * problem starts. Fourteen idle minutes is long enough for the access token
     * to be at or past expiry — a keep-alive tick can have been missed, or the
     * tab suspended through one — so "stay signed in" that only reset the clock
     * would hand the user back an app that 401s on their next click. Repair it
     * now, while they are demonstrably here.
     */
    try {
      const result = await validateAndRefreshSession({ quiet: true });
      if (!result.success) {
        console.warn('Could not renew the session after the idle warning:', result.error);
      }
    } catch (err) {
      console.warn('Could not renew the session after the idle warning:', err?.message || err);
    }
  }, []);

  const handleSignOutNow = useCallback(async () => {
    setIdleWarningOpen(false);
    sessionStorage.setItem(LOGOUT_REASON_KEY, 'idle');
    await authActionsRef.current?.logout?.();
  }, []);

  // A session that ends for any other reason must not leave the countdown up.
  useEffect(() => {
    if (!sessionHooksEnabled) setIdleWarningOpen(false);
  }, [sessionHooksEnabled]);

  useIdleLogout({
    enabled: sessionHooksEnabled,
    timeoutMs: IDLE_LOGOUT_TIMEOUT,
    warnBeforeMs: IDLE_LOGOUT_WARN_BEFORE_MS,
    onWarning: handleIdleWarning,
    onWarningCleared: handleIdleWarningCleared,
    onIdle: handleIdleLogout,
  });

  const handleSessionAuthError = useCallback(
    (error, options = {}) =>
      handleSessionAuthErrorUtil(error, { logout: stableLogout, ...options }),
    [stableLogout]
  );

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isAuthenticated,
    user,
    session,
    loading,
    login: stableLogin,
    loginWithGithub: stableLoginWithGithub,
    loginAsDemo,
    switchDemoRole,
    logout: stableLogout,
    signOut: stableLogout, // Alias for backward compatibility
    handleSessionAuthError,
    forgotPassword: stableForgotPassword,
    resetPassword: stableResetPassword,
    checkPermission
  }), [isAuthenticated, user, session, loading, stableLogin, stableLoginWithGithub, loginAsDemo, switchDemoRole, stableLogout, handleSessionAuthError, stableForgotPassword, stableResetPassword, checkPermission]);

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Outside `children` on purpose: the countdown belongs to the session,
          not to whatever screen happens to be routed. */}
      <IdleWarningModal
        open={idleWarningOpen}
        timeoutMs={IDLE_LOGOUT_TIMEOUT}
        onStay={handleStaySignedIn}
        onSignOut={handleSignOutNow}
      />
    </AuthContext.Provider>
  );
};
