import assert from 'node:assert/strict';
import test from 'node:test';
import { createPasswordRecoveryHandler } from '../supabase/functions/_shared/passwordRecovery.mjs';
import { normalizeRecoveryEmail } from '../supabase/functions/_shared/recoveryEmail.mjs';

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json' },
});
const request = (body = { email: 'person@example.com' }, method = 'POST') => new Request('https://edge.example.test/recovery', {
  method, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
});

function fixture({ registeredEmail = 'Person@Example.com', lookupStatus = 200, authStatus = 200,
  authBody = {}, transportError = false, missingConfig = false } = {}) {
  const calls = [];
  const handler = createPasswordRecoveryHandler({
    supabaseUrl: 'https://auth.example.test', anonKey: 'public-key',
    serviceRoleKey: missingConfig ? '' : 'private-key', redirectTo: 'https://hr.icue.vn/reset-password',
    fetchImpl: async (input, options) => {
      const url = new URL(input);
      calls.push({ url, ...options, body: JSON.parse(options.body) });
      if (transportError) throw new Error('Private transport diagnostics');
      if (url.pathname === '/rest/v1/rpc/password_recovery_email') return json(registeredEmail, lookupStatus);
      if (url.pathname === '/auth/v1/recover') return json(authBody, authStatus);
      throw new Error(`Unexpected request ${url.pathname}`);
    },
  });
  return { handler, calls };
}

test('recovery preflight and unsupported methods never contact the database or Auth', async () => {
  const { handler, calls } = fixture();
  assert.equal((await handler(request(null, 'OPTIONS'))).status, 200);
  assert.equal((await handler(request(null, 'GET'))).status, 405);
  assert.deepEqual(calls, []);
});

test('only a normalized syntactically valid email can reach the privileged lookup', async () => {
  const invalid = [undefined, null, 42, {}, '', ' ', 'not-an-email', 'a@@example.com',
    'a@example', '.a@example.com', 'a.@example.com', 'a..b@example.com', 'a b@example.com',
    'a\r\nb@example.com', 'a@-example.com', 'a@example-.com', 'a@example..com',
    'a@example.123', `${'a'.repeat(65)}@example.com`, `a@${'b'.repeat(64)}.com`,
    `${'a'.repeat(64)}@${Array(4).fill('b'.repeat(60)).join('.')}.com`];
  const { handler, calls } = fixture();
  for (const email of invalid) {
    assert.equal(normalizeRecoveryEmail(email), null, String(email));
    const result = await handler(request({ email }));
    assert.equal(result.status, 400);
    assert.deepEqual(await result.json(), { success: false, code: 'email_address_invalid' });
  }
  const malformed = await handler(new Request('https://edge.example.test/recovery', { method: 'POST', body: '{' }));
  assert.equal(malformed.status, 400);
  assert.deepEqual(calls, []);
});

test('unknown Auth addresses are rejected without ever calling email delivery', async () => {
  const { handler, calls } = fixture({ registeredEmail: null });
  const result = await handler(request());
  assert.equal(result.status, 404);
  assert.deepEqual(await result.json(), { success: false, code: 'user_not_found' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.pathname, '/rest/v1/rpc/password_recovery_email');
});

test('only an exact registered Auth email proceeds to native delivery with the fixed redirect', async () => {
  const { handler, calls } = fixture();
  const result = await handler(request({
    email: '  PERSON@EXAMPLE.COM  ', redirectTo: 'https://attacker.example/', to: 'other@example.com',
  }));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { success: true });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].body, { p_email: 'person@example.com' });
  assert.equal(calls[0].headers.apikey, 'private-key');
  assert.equal(calls[0].headers.Authorization, 'Bearer private-key');
  assert.equal(calls[1].url.pathname, '/auth/v1/recover');
  assert.equal(calls[1].url.searchParams.get('redirect_to'), 'https://hr.icue.vn/reset-password');
  assert.deepEqual(calls[1].body, { email: 'Person@Example.com' });
  assert.equal(calls[1].headers.apikey, 'public-key');
  assert.equal(calls[1].headers.Authorization, undefined);
});

test('incomplete configuration, lookup failures and mismatched lookup data all fail closed', async () => {
  for (const settings of [{ missingConfig: true }, { lookupStatus: 503 }, { registeredEmail: 'other@example.com' },
    { registeredEmail: { email: 'person@example.com' } }, { registeredEmail: '' }]) {
    const { handler, calls } = fixture(settings);
    const result = await handler(request());
    assert.equal(result.status, 503);
    assert.deepEqual(await result.json(), { success: false, code: 'unexpected_failure' });
    assert.ok(calls.every((call) => call.url.pathname !== '/auth/v1/recover'));
  }
});

test('transport failures fail closed without retries or private diagnostics', async () => {
  const { handler, calls } = fixture({ transportError: true });
  const result = await handler(request());
  assert.equal(result.status, 503);
  assert.deepEqual(await result.json(), { success: false, code: 'unexpected_failure' });
  assert.equal(calls.length, 1);
});

for (const [authStatus, code, expectedStatus, expectedCode] of [
  [429, 'over_email_send_rate_limit', 429, 'over_email_send_rate_limit'],
  [429, 'over_request_rate_limit', 429, 'over_request_rate_limit'],
  [422, 'email_address_invalid', 502, 'email_address_invalid'],
  [400, 'user_banned', 502, 'user_banned'],
  [400, 'email_not_confirmed', 502, 'email_not_confirmed'],
  [404, 'user_not_found', 502, 'user_not_found'],
  [500, 'private_provider_detail', 502, 'unexpected_failure'],
]) {
  test(`native Auth rejection ${code} remains an error and is never reported as sent`, async () => {
    const { handler, calls } = fixture({ authStatus, authBody: { code, message: 'Private SMTP diagnostics' } });
    const result = await handler(request());
    assert.equal(result.status, expectedStatus);
    assert.deepEqual(await result.json(), { success: false, code: expectedCode });
    assert.equal(calls.length, 2);
  });
}
