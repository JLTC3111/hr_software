import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { loadSource } from './helpers/loadSource.js';
import * as authEvents from '../src/utils/authEvents.js';
import * as authErrors from '../src/utils/authErrors.js';
import * as routes from '../src/config/routes.js';
import * as timeouts from '../src/config/requestTimeouts.js';

const recoverySession = { access_token: 'fixture-recovery-token', user: { id: 'fixture-user' } };
const recoveryHash = '#type=recovery&access_token=fixture-recovery-token';

function hooks() {
  const values = [];
  const effects = [];
  let cursor = 0;
  let rendered = false;
  return {
    effects,
    render: component => { cursor = 0; const result = component(); rendered = true; return result; },
    createContext: () => ({ Provider: 'provider' }),
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial;
      return [values[index], value => { values[index] = typeof value === 'function' ? value(values[index]) : value; }];
    },
    useRef: initial => {
      const index = cursor++;
      return values[index] ||= { current: initial };
    },
    useEffect: effect => { if (!rendered) effects.push(effect); },
    useCallback: callback => callback,
    useMemo: factory => factory(),
  };
}

function mountProvider({ client, hash = recoveryHash, timers = false }) {
  const react = hooks();
  let persistedIdleMs = timeouts.IDLE_LOGOUT_TIMEOUT + 60000;
  const stats = { resets: 0, storageClears: 0 };
  const consumeRecoverySession = authEvents.createRecoverySessionConsumer(hash);
  const { AuthProvider } = loadSource('src/contexts/AuthContext.jsx', {
    react,
    '../config/supabaseClient.js': { supabase: client, consumeRecoverySession, clearAuthStorage: () => { stats.storageClears++; } },
    '../utils/sessionHelper.js': { cancelScheduledLogout() {}, resetSessionVerification() {}, markSessionVerified() {}, isRejectedByServer: authErrors.isRejectedByServer },
    '../utils/demoHelper.js': { isDemoMode: () => false, disableDemoMode() {} },
    '../utils/activityTracker.js': {
      getPersistedIdleDurationMs: () => persistedIdleMs,
      getIdleDurationMs: () => persistedIdleMs,
      resetActivity: () => { stats.resets++; persistedIdleMs = 0; },
      clearPersistedActivity: () => { persistedIdleMs = null; },
    },
    '../utils/supabaseTimeout.js': { withTimeout: promise => promise },
    '../utils/authEvents.js': authEvents,
    '../utils/authErrors.js': authErrors,
    '../config/routes.js': routes,
    '../hooks/useSessionKeepAlive.js': { useSessionKeepAlive() {} },
    '../hooks/useIdleLogout.js': { useIdleLogout() {} },
    '../components/idleWarningModal.jsx': { default: 'idle-warning' },
    '../config/requestTimeouts.js': timeouts,
  }, {
    React: react,
    setTimeout: timers ? setTimeout : () => 1,
    clearTimeout: timers ? clearTimeout : () => {},
    sessionStorage: { setItem() {} },
  });
  const render = () => react.render(() => AuthProvider({ children: null })).props.value;
  render();
  const cleanup = react.effects[0]();
  return { stats, render, cleanup };
}

function fakeClient() {
  const stats = { signOuts: [], getUserCalls: 0 };
  let listener;
  const client = { auth: {
    onAuthStateChange: callback => { listener = callback; return { data: { subscription: { unsubscribe() {} } } }; },
    signOut: async options => { stats.signOuts.push(options); return { error: null }; },
    getUser: async () => { stats.getUserCalls++; return { data: { user: recoverySession.user }, error: null }; },
  } };
  return { client, stats, emit: (event, session) => listener(event, session) };
}

test('a recovery callback matches only its SDK session and can be consumed once', () => {
  const consume = authEvents.createRecoverySessionConsumer(recoveryHash);
  assert.equal(consume({ access_token: 'older-session' }), false);
  assert.equal(consume(null), false);
  assert.equal(consume(recoverySession), true);
  assert.equal(consume(recoverySession), false);
  for (const hash of ['', '#type=recovery', '#type=signup&access_token=fixture-recovery-token', recoveryHash + '&error_code=otp_expired']) {
    assert.equal(authEvents.createRecoverySessionConsumer(hash)(recoverySession), false);
  }
});

for (const events of [
  ['INITIAL_SESSION', 'PASSWORD_RECOVERY'],
  ['PASSWORD_RECOVERY', 'INITIAL_SESSION'],
  ['INITIAL_SESSION'], // The SDK may have consumed the URL before the provider mounted.
]) {
  test(`fresh recovery survives stale idle activity with ${events.join(' then ')}`, async () => {
    const fake = fakeClient();
    const provider = mountProvider({ client: fake.client });
    for (const event of events) await fake.emit(event, recoverySession);
    assert.equal(fake.stats.signOuts.length, 0, 'A newly verified recovery session must not be signed out');
    assert.equal(provider.stats.storageClears, 0);
    assert.equal(fake.stats.getUserCalls, 0, 'A verified recovery callback must not re-enter the SDK lock');
    assert.ok(provider.stats.resets > 0, 'Recovery starts a fresh activity window');
    assert.equal(provider.render().session?.access_token, recoverySession.access_token);
    assert.equal(provider.render().loading, false);
    provider.cleanup();
  });
}

test('ordinary idle sessions still expire, including an unmatched recovery callback', async () => {
  for (const hash of ['', recoveryHash, recoveryHash + '&error_code=otp_expired']) {
    const fake = fakeClient();
    const provider = mountProvider({ client: fake.client, hash });
    await fake.emit('INITIAL_SESSION', { ...recoverySession, access_token: 'older-session' });
    assert.equal(fake.stats.signOuts.length, 1);
    assert.equal(fake.stats.signOuts[0].scope, 'local');
    assert.equal(provider.stats.storageClears, 1);
    assert.equal(provider.stats.resets, 0);
    assert.equal(provider.render().session, null);
    provider.cleanup();
  }
});

for (const expired of [false, true]) {
  test(expired
    ? 'an expired callback stays invalid even with an existing session in storage'
    : 'the installed SDK, real auth provider and reset screen retain a fresh recovery session', async () => {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const previousBroadcastChannel = globalThis.BroadcastChannel;
    globalThis.document = { visibilityState: 'hidden' };
    globalThis.BroadcastChannel = undefined;
    globalThis.window = { addEventListener() {}, removeEventListener() {} };
    const { createClient } = createRequire(import.meta.url)('@supabase/supabase-js');
    const user = { id: 'd34fd884-647f-4f4e-a8a9-caa245b8d989', email: 'recovery@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const accessToken = [{ alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp: expiresAt, role: 'authenticated' }]
      .map(value => Buffer.from(JSON.stringify(value)).toString('base64url')).join('.') + '.test-signature';
    const values = new Map();
    const storageKey = 'recovery-test-' + expired;
    if (expired) values.set(storageKey, JSON.stringify({ access_token: accessToken, refresh_token: 'fixture-refresh', expires_in: 3600, expires_at: expiresAt, token_type: 'bearer', user }));
    const requests = [];
    const hash = expired ? 'error=access_denied&error_code=otp_expired&error_description=Email+link+has+expired'
      : new URLSearchParams({ access_token: accessToken, refresh_token: 'fixture-refresh', expires_in: '3600', expires_at: String(expiresAt), token_type: 'bearer', type: 'recovery' }).toString();
    window.location = new URL('https://hr.icue.vn/reset-password#' + hash);
    let client;
    let provider;
    let screenCleanup;
    try {
      client = createClient('https://auth.example.test', 'fixture-anon-key', {
        auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: true, storageKey,
          storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } },
        global: { fetch: async (input, options) => {
          const url = new URL(input);
          requests.push({ path: url.pathname, method: options.method });
          assert.equal(url.hostname, 'auth.example.test');
          assert.equal(url.pathname, '/auth/v1/user');
          assert.equal(options.method, 'GET');
          return new Response(JSON.stringify(user), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } },
      });
      provider = mountProvider({ client, hash: '#' + hash, timers: true });
      await client.auth.initialize();
      await new Promise(resolve => setTimeout(resolve, 10));
      const react = hooks();
      const { default: ResetPassword } = loadSource('src/components/ResetPassword.jsx', {
        react,
        'react-router-dom': { useNavigate: () => () => { throw new Error('Unexpected navigation'); } },
        '../contexts/AuthContext': { useAuth: () => ({ resetPassword: () => { throw new Error('Unexpected password change'); } }) },
        '../contexts/ThemeContext': { useTheme: () => ({ isDarkMode: false, text: {} }) },
        '../contexts/LanguageContext': { useLanguage: () => ({ currentLanguage: 'en', t: (_key, fallback) => fallback }) },
        'lucide-react': {},
        '../config/supabaseClient': { supabase: client },
      }, { window, URLSearchParams, setTimeout, clearTimeout });
      react.render(ResetPassword);
      screenCleanup = react.effects[0]();
      await new Promise(resolve => setTimeout(resolve, 20));
      const screen = JSON.stringify(react.render(ResetPassword));
      assert.equal(screen.includes('"type":"form"'), !expired);
      assert.equal(screen.includes('Invalid or expired reset link'), expired);
      assert.equal((await client.auth.getSession()).data.session?.access_token, expired ? undefined : accessToken);
      assert.ok(requests.every(request => request.path === '/auth/v1/user'), 'Recovery must not call logout');
      assert.equal(provider.stats.storageClears, 0);
    } finally {
      screenCleanup?.();
      provider?.cleanup();
      await client?.auth.stopAutoRefresh();
      globalThis.window = previousWindow;
      globalThis.document = previousDocument;
      globalThis.BroadcastChannel = previousBroadcastChannel;
    }
  });
}
