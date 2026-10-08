import test from 'node:test';
import assert from 'node:assert/strict';
import * as hrAuth from '../supabase/functions/_shared/hrAuth.js';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';

const profile = { id: 'hr-admin', role: 'admin', is_active: true, employment_status: 'active' };
const actorLink = { auth_user_id: 'auth-admin', hr_user_id: 'hr-admin' };

test('active HR admin authorization supports mapped and direct logins', async () => {
  assert.equal((await hrAuth.getActiveHrAdmin(queryFixture({ user_emails: [actorLink], hr_users: [profile] }), 'auth-admin')).id, 'hr-admin');
  assert.equal((await hrAuth.getActiveHrAdmin(queryFixture({ hr_users: [{ ...profile, id: 'auth-admin' }] }), 'auth-admin')).id, 'auth-admin');
});

for (const change of [{ is_active: false }, { employment_status: 'terminated' }, { employment_status: 'inactive' }, { role: 'employee' }, { role: 'manager' }]) {
  test(`admin authorization rejects ${JSON.stringify(change)}`, async () => {
    const client = queryFixture({ user_emails: [actorLink], hr_users: [{ ...profile, ...change }] });
    assert.equal(await hrAuth.getActiveHrAdmin(client, 'auth-admin'), null);
  });
}

test('missing, ambiguous and failing identity lookups never fall back to admin claims', async () => {
  assert.equal(await hrAuth.getActiveHrAdmin(queryFixture(), 'missing'), null);
  await assert.rejects(hrAuth.getActiveHrAdmin(queryFixture({ user_emails: [actorLink, { ...actorLink, hr_user_id: 'other-profile' }] }), 'auth-admin'), /Ambiguous/);
  await assert.rejects(hrAuth.getActiveHrAdmin(queryFixture({}, { user_emails: new Error('Database unavailable') }), 'auth-admin'), /unavailable/);
});

test('password reset resolves every linked Auth identity using hr_user_id', async () => {
  const client = queryFixture({ user_emails: [
    { hr_user_id: 'target', auth_user_id: 'auth-one' },
    { hr_user_id: 'target', auth_user_id: 'auth-two' },
    { hr_user_id: 'target', auth_user_id: 'auth-one' },
    { hr_user_id: 'other', auth_user_id: 'unrelated' },
  ] });
  assert.deepEqual(await hrAuth.getHrAuthUserIds(client, 'target'), ['auth-one', 'auth-two']);
  assert.deepEqual(await hrAuth.getHrAuthUserIds(client, 'legacy-direct'), ['legacy-direct']);
  await assert.rejects(hrAuth.getHrAuthUserIds(queryFixture({}, { user_emails: new Error('Mapping failure') }), 'target'), /Mapping failure/);
});

function edgeHandler(name, client, user = { id: 'auth-admin' }) {
  let handler;
  client.auth = {
    getUser: async () => ({ data: { user }, error: null }),
    admin: client.admin || {},
  };
  loadSource(`supabase/functions/${name}/index.ts`, {
    'https://deno.land/std@0.168.0/http/server.ts': { serve: fn => { handler = fn; } },
    'https://esm.sh/@supabase/supabase-js@2': { createClient: () => client },
    'jsr:@supabase/functions-js/edge-runtime.d.ts': {},
    '../_shared/hrAuth.js': hrAuth,
  }, { Deno: { env: { get: () => 'fixture' }, serve: fn => { handler = fn; } } });
  return handler;
}

const request = (body) => new Request('https://fixture.test/function', {
  method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer fixture-token', 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

test('actual visit handler rejects forged editable admin metadata without querying visits', async () => {
  const client = queryFixture();
  const handler = edgeHandler('visit-summary', client, { id: 'outsider', user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } });
  const result = await handler(request());
  assert.equal(result.status, 403);
  assert.equal(client.calls.some(call => call.table === 'visits'), false);
});

test('actual visit handler accepts mapped active admin and rejects inactive admin', async () => {
  for (const active of [true, false]) {
    const client = queryFixture({ user_emails: [actorLink], hr_users: [{ ...profile, is_active: active }], visits: [] });
    const result = await edgeHandler('visit-summary', client)(request());
    assert.equal(result.status, active ? 200 : 403);
    assert.equal(client.calls.some(call => call.table === 'visits'), active);
  }
});

test('actual reset handler updates mapped target accounts, never the profile or unrelated Auth IDs', async () => {
  const updates = [];
  const client = queryFixture({
    hr_users: [profile, { id: 'target' }],
    user_emails: [actorLink, { hr_user_id: 'target', auth_user_id: 'target-one' }, { hr_user_id: 'target', auth_user_id: 'target-two' }],
  });
  client.admin = { updateUserById: async (id, payload) => { updates.push([id, payload.password]); return { error: null }; } };
  const result = await edgeHandler('admin-reset-password', client)(request({ userId: 'target', newPassword: 'fixture-password' }));
  assert.equal(result.status, 200);
  assert.deepEqual(updates, [['target-one', 'fixture-password'], ['target-two', 'fixture-password']]);
  assert.equal('user' in await result.json(), false);
});

test('actual reset handler fails closed when target mapping fails', async () => {
  const client = queryFixture({ hr_users: [profile, { id: 'target' }], user_emails: [actorLink] }, {
    user_emails: calls => calls.some(call => call.method === 'eq' && call.args[0] === 'hr_user_id') ? new Error('Lookup failed') : null,
  });
  let changed = false;
  client.admin = { updateUserById: async () => { changed = true; return { error: null }; } };
  const result = await edgeHandler('admin-reset-password', client)(request({ userId: 'target', newPassword: 'fixture-password' }));
  assert.notEqual(result.status, 200);
  assert.equal(changed, false);
  assert.equal(client.calls.some(call => call.method === 'eq' && call.args[0] === 'hr_user_id'), true);
});

test('actual delete handler prevents an administrator deleting their own mapped profile', async () => {
  const client = queryFixture({ hr_users: [profile], user_emails: [actorLink] });
  let deleted = false;
  client.admin = { deleteUser: async () => { deleted = true; return { error: null }; } };
  const result = await edgeHandler('admin-delete-user', client)(request({ userId: 'hr-admin' }));
  assert.equal(result.status, 400);
  assert.equal(deleted, false);
});

test('actual delete handler removes every target login alias after resolving the HR profile', async () => {
  const client = queryFixture({
    hr_users: [profile, { id: 'target', email: 'target@example.test' }],
    user_emails: [actorLink, { hr_user_id: 'target', auth_user_id: 'target-one' }, { hr_user_id: 'target', auth_user_id: 'target-two' }],
  });
  const deleted = [];
  client.admin = { deleteUser: async id => { deleted.push(id); return { error: null }; } };
  const result = await edgeHandler('admin-delete-user', client)(request({ userId: 'target' }));
  assert.equal(result.status, 200);
  assert.deepEqual(deleted, ['target-one', 'target-two']);
  const clearedReferences = client.calls.filter(call => call.method === 'in');
  assert.equal(clearedReferences.length, 3);
  for (const call of clearedReferences) assert.deepEqual(call.args[1], ['target-one', 'target-two']);
});

for (const code of ['42P01', 'PGRST205']) {
  test(`actual delete handler supports an HR-only database with absent optional tables (${code})`, async () => {
    const errors = Object.fromEntries(['phase_milestones', 'phase_resources'].map(table => [table,
      { code, message: code === '42P01' ? `relation "public.${table}" does not exist` : `Could not find the table 'public.${table}' in the schema cache` },
    ]));
    const client = queryFixture({ hr_users: [profile, { id: 'target' }], user_emails: [actorLink] }, errors);
    const deleted = [];
    client.admin = { deleteUser: async id => { deleted.push(id); return { error: null }; } };
    const result = await edgeHandler('admin-delete-user', client)(request({ userId: 'target' }));
    assert.equal(result.status, 200);
    assert.deepEqual(deleted, ['target']);
  });
}

for (const [table, error] of [
  ['visits', { code: '42P01', message: 'relation "public.visits" does not exist' }],
  ['phase_resources', { code: '42501', message: 'Permission denied' }],
  ['phase_milestones', { code: 'PGRST204', message: 'Missing assigned_to column' }],
  ['phase_milestones', { code: '42P01', message: 'relation "public.required_dependency" does not exist' }],
]) {
  test(`actual delete handler rejects genuine reference cleanup failure: ${table} ${error.code}`, async () => {
    const client = queryFixture({ hr_users: [profile, { id: 'target' }], user_emails: [actorLink] }, { [table]: error });
    let deleted = false;
    client.admin = { deleteUser: async () => { deleted = true; return { error: null }; } };
    const result = await edgeHandler('admin-delete-user', client)(request({ userId: 'target' }));
    assert.equal(result.status, 500);
    assert.equal(deleted, false);
  });
}

test('actual record-visit handler returns success only after a successful insert', async () => {
  for (const fail of [false, true]) {
    const client = queryFixture({}, fail ? { visits: { code: 'PGRST204', message: 'Schema unavailable' } } : {});
    const result = await edgeHandler('record-visit', client)(new Request('https://fixture.test/function', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': '192.0.2.7' },
      body: JSON.stringify({ path: '/dashboard' }),
    }));
    assert.equal(result.status, fail ? 500 : 204);
    const payload = client.calls.find(call => call.method === 'insert').args[0];
    assert.equal(payload.anonymized_ip, '192.0.2.0');
    assert.equal(payload.path, '/dashboard');
    if (fail) assert.equal((await result.json()).success, false);
  }
});
