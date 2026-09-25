import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { resolvePasswordResetUrl } from '../src/config/routes.js';

test('web password reset works without a configured app URL', () => {
  assert.equal(resolvePasswordResetUrl(undefined, 'https://hr.icue.vn'), 'https://hr.icue.vn/reset-password');
  assert.equal(resolvePasswordResetUrl('', 'https://hr.icue.vn'), 'https://hr.icue.vn/reset-password');
});

test('the web callback defaults to the current browser origin at request time', (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://hr.icue.vn/login') });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, 'location', previous);
    else delete globalThis.location;
  });
  assert.equal(resolvePasswordResetUrl(), 'https://hr.icue.vn/reset-password');
});

test('configured website takes precedence for desktop and local development', () => {
  for (const origin of ['hr-app://app', 'null', 'http://localhost:5173']) {
    assert.equal(resolvePasswordResetUrl('https://hr.icue.vn', origin), 'https://hr.icue.vn/reset-password');
  }
});

test('a trailing slash or existing path cannot produce the wrong reset route', () => {
  for (const base of ['https://hr.icue.vn/', 'https://hr.icue.vn/login', 'https://hr.icue.vn/?tab=login']) {
    assert.equal(resolvePasswordResetUrl(base), 'https://hr.icue.vn/reset-password');
  }
});

test('local web development preserves its origin and port', () => {
  assert.equal(resolvePasswordResetUrl(undefined, 'http://localhost:5173'), 'http://localhost:5173/reset-password');
});

test('packaged apps without a website URL cannot email a native or file callback', () => {
  for (const origin of ['hr-app://app', 'capacitor://localhost', 'file:///Applications/HR/index.html', 'null', undefined]) {
    assert.throws(() => resolvePasswordResetUrl(undefined, origin), /Set VITE_APP_URL or VITE_SITE_URL/);
  }
});

test('invalid configured callbacks are rejected rather than silently replaced', () => {
  for (const url of ['not-a-url', '/relative', 'javascript:alert(1)', 'https://user:secret@hr.icue.vn']) {
    assert.throws(() => resolvePasswordResetUrl(url, 'https://hr.icue.vn'), /Set VITE_APP_URL or VITE_SITE_URL/);
  }
});

test('the installed Supabase SDK sends the absolute HR recovery URL', async (t) => {
  const requests = [];
  const client = createClient('https://auth.example.test', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, options) => {
      requests.push({ url: new URL(input), options });
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    } },
  });
  t.after(() => client.auth.stopAutoRefresh());
  const { error } = await client.auth.resetPasswordForEmail('recovery@example.test', {
    redirectTo: resolvePasswordResetUrl(undefined, 'https://hr.icue.vn'),
  });
  assert.equal(error, null);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, '/auth/v1/recover');
  assert.equal(requests[0].url.searchParams.get('redirect_to'), 'https://hr.icue.vn/reset-password');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(JSON.parse(requests[0].options.body).email, 'recovery@example.test');
});
