import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { requestPasswordRecovery } from '../src/utils/passwordRecoveryRequest.js';
import { getPasswordResetErrorKey } from '../src/utils/authErrors.js';

const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

function sdkClient(t, fetch) {
  const client = createClient('https://auth.example.test', 'test-anon-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch },
  });
  t.after(() => client.auth.stopAutoRefresh());
  return client;
}

test('invalid recovery addresses never reach the backend or sender', async () => {
  let calls = 0;
  const client = { functions: { invoke: async () => { calls++; return { data: { success: true } }; } } };
  for (const email of [undefined, null, {}, '', 'not-an-email', 'a@b', 'a@@example.com',
    'a b@example.com', 'a..b@example.com', '.a@example.com', 'a@example..com',
    'a@-example.com', 'a@example.com\r\nBcc: other@example.com', `${'a'.repeat(65)}@example.com`]) {
    await assert.rejects(requestPasswordRecovery(client, email), (error) => {
      assert.equal(error.code, 'email_address_invalid');
      assert.equal(getPasswordResetErrorKey(error), 'login.forgotPasswordModal.emailInvalid');
      return true;
    });
  }
  assert.equal(calls, 0);
});

test('the installed SDK sends normalized recovery only to the HR server endpoint', async (t) => {
  const requests = [];
  const client = sdkClient(t, async (input, options) => {
    requests.push({ url: new URL(input), options });
    return response({ success: true });
  });
  await requestPasswordRecovery(client, '  Known.User+tag@Example.COM  ');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url.pathname, '/functions/v1/hr-password-recovery');
  assert.equal(requests[0].options.method, 'POST');
  assert.deepEqual(JSON.parse(requests[0].options.body), { email: 'known.user+tag@example.com' });
  assert.equal(new Headers(requests[0].options.headers).get('Authorization'), 'Bearer test-anon-key');
  assert.ok(requests.every(({ url }) => url.pathname !== '/auth/v1/recover'));
});

test('an unknown Auth email returns the no-account notice instead of sent success', async (t) => {
  const requests = [];
  const client = sdkClient(t, async (input) => {
    requests.push(new URL(input).pathname);
    return response({ success: false, code: 'user_not_found' }, 404);
  });
  await assert.rejects(requestPasswordRecovery(client, 'unknown@example.com'), (error) => {
    assert.equal(error.code, 'user_not_found');
    assert.equal(error.status, 404);
    assert.equal(getPasswordResetErrorKey(error), 'login.forgotPasswordModal.noAccount');
    return true;
  });
  assert.deepEqual(requests, ['/functions/v1/hr-password-recovery']);
});

test('HTTP recovery errors retain safe validation and rate-limit notices', async (t) => {
  for (const [status, code, key] of [
    [400, 'email_address_invalid', 'emailInvalid'],
    [429, 'over_email_send_rate_limit', 'emailRateLimitError'],
    [429, 'over_request_rate_limit', 'rateLimitError'],
  ]) {
    const client = sdkClient(t, async () => response({ success: false, code }, status));
    await assert.rejects(requestPasswordRecovery(client, 'known@example.com'), (error) => {
      assert.equal(error.code, code);
      assert.equal(getPasswordResetErrorKey(error), `login.forgotPasswordModal.${key}`);
      return true;
    });
  }
});

test('recovery requires explicit success true even when the endpoint returns HTTP 200', async () => {
  for (const data of [undefined, null, {}, { success: false }, { success: 'true' }, { success: 1 }]) {
    const client = { functions: { invoke: async () => ({ data, error: null }) } };
    await assert.rejects(requestPasswordRecovery(client, 'known@example.com'), /Password recovery request failed/);
  }
});

test('HTTP service failure never becomes success or leaks provider details', async (t) => {
  let calls = 0;
  const client = sdkClient(t, async () => {
    calls++;
    return response({ success: false, code: 'unexpected_failure', error: 'private provider diagnostic' }, 503);
  });
  await assert.rejects(requestPasswordRecovery(client, 'known@example.com'), (error) => {
    assert.equal(error.code, 'unexpected_failure');
    assert.equal(error.status, 503);
    assert.equal(getPasswordResetErrorKey(error), 'login.forgotPasswordModal.error');
    assert.equal(error.message.includes('private provider diagnostic'), false);
    return true;
  });
  assert.equal(calls, 1, 'recovery sends must not be automatically retried');
});

test('network failure never becomes success and is not retried', async (t) => {
  let calls = 0;
  const client = sdkClient(t, async () => { calls++; throw new TypeError('Failed to fetch'); });
  await assert.rejects(requestPasswordRecovery(client, 'known@example.com'), (error) => {
    assert.equal(error.code, 'network_error');
    assert.equal(getPasswordResetErrorKey(error), 'login.forgotPasswordModal.networkError');
    return true;
  });
  assert.equal(calls, 1);
});

test('unreadable error bodies fail closed without a sent notice', async (t) => {
  const client = sdkClient(t, async () => new Response('gateway unavailable', { status: 502 }));
  await assert.rejects(requestPasswordRecovery(client, 'known@example.com'), (error) => {
    assert.equal(error.status, 502);
    assert.equal(getPasswordResetErrorKey(error), 'login.forgotPasswordModal.error');
    return true;
  });
});

test('an invocation error takes precedence over a misleading success body', async () => {
  const client = { functions: { invoke: async () => ({ data: { success: true }, error: new Error('failed') }) } };
  await assert.rejects(requestPasswordRecovery(client, 'known@example.com'));
});
