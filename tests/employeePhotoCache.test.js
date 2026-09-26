import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';

const photoService = (client, withTimeout = query => query, globals = {}) => loadSource('src/services/employeeService.js', {
  '../config/supabaseClient.js': { supabase: client },
  '../utils/supabaseTimeout.js': { withTimeout },
  '../config/requestTimeouts.js': { DEFAULT_REQUEST_TIMEOUT: 1000 },
  '../utils/demoHelper.js': { isDemoMode: () => false },
  '../utils/demoStorage.js': {}, '../utils/pdfPreviewUrl.js': {}, './documentService.js': {},
}, globals);

test('roster query omits photos and portrait cache expires after five minutes', async () => {
  let now = 1000;
  class Clock extends Date { static now() { return now; } }
  const client = queryFixture({ employees: [{ id: 'a', photo: 'first' }] }, {}, { persist: true });
  const service = photoService(client, undefined, { Date: Clock });
  await service.getAllEmployees();
  assert.equal(client.calls.find(call => call.method === 'select').args[0].includes('photo'), false);
  const first = await service.getEmployeePhotos();
  assert.equal(first.data.a, 'first');
  client.tables.employees[0].photo = 'second';
  now += 299999;
  assert.equal((await service.getEmployeePhotos()).data.a, 'first');
  now += 1;
  assert.equal((await service.getEmployeePhotos()).data.a, 'second');
  assert.equal(client.calls.filter(call => call.method === 'select' && call.args[0].includes('avatar_url')).length, 2);
});

test('photo update removal employee deletion and auth cache clear invalidate portraits', async () => {
  const client = queryFixture({ employees: [{ id: 'a', photo: 'first' }] }, {}, { persist: true });
  const service = photoService(client);
  assert.equal((await service.getEmployeePhotos()).data.a, 'first');
  assert.equal((await service.updateEmployee('a', { photo: 'second' })).success, true);
  assert.equal((await service.getEmployeePhotos()).data.a, 'second');
  assert.equal((await service.updateEmployee('a', { photo: null })).success, true);
  assert.equal((await service.getEmployeePhotos()).data.a, undefined);
  client.tables.employees[0].photo = 'third';
  service.clearEmployeePhotoCache();
  assert.equal((await service.getEmployeePhotos()).data.a, 'third');
  assert.equal((await service.deleteEmployee('a')).success, true);
  assert.equal((await service.getEmployeePhotos()).data.a, undefined);
});

test('concurrent portrait callers share one request and invalidated in-flight data cannot repopulate cache', async () => {
  const client = queryFixture({ employees: [{ id: 'a', photo: 'old' }] }, {}, { persist: true });
  let release;
  let requests = 0;
  const service = photoService(client, async query => {
    const result = await query;
    requests += 1;
    if (requests === 1) await new Promise(resolve => { release = resolve; });
    return result;
  });
  const first = service.getEmployeePhotos();
  const second = service.getEmployeePhotos();
  while (!release) await Promise.resolve();
  assert.equal(requests, 1);
  await service.updateEmployee('a', { photo: 'new' });
  release();
  assert.equal((await first).success, false);
  assert.equal((await second).success, false);
  assert.equal((await service.getEmployeePhotos()).data.a, 'new');
  assert.equal(requests, 2);
});

test('portrait cache releases expired data, notifies subscribers, and invalidates changes from another tab', async () => {
  const events = new Map();
  const timers = new Map();
  const writes = [];
  let nextTimer = 0;
  const window = {
    setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout: id => timers.delete(id),
    addEventListener: (event, fn) => events.set(event, fn),
    removeEventListener: event => events.delete(event),
    localStorage: { setItem: (...args) => writes.push(args) },
  };
  const client = queryFixture({ employees: [{ id: 'a', photo: 'old' }] }, {}, { persist: true });
  const service = photoService(client, undefined, { window });
  let notifications = 0;
  const unsubscribe = service.subscribeEmployeePhotoChanges(() => { notifications++; });
  await service.getEmployeePhotos();
  await service.updateEmployee('a', { photo: 'new' });
  assert.equal(notifications, 1);
  assert.equal(writes[0][0], 'hr:portrait-change');
  assert.equal((await service.getEmployeePhotos()).data.a, 'new');
  client.tables.employees[0].photo = null;
  events.get('storage')({ key: 'hr:portrait-change' });
  assert.equal(notifications, 2);
  assert.equal((await service.getEmployeePhotos()).data.a, undefined);
  client.tables.employees[0].photo = 'expired';
  [...timers.values()].at(-1)();
  assert.equal((await service.getEmployeePhotos()).data.a, 'expired');
  unsubscribe();
  service.clearEmployeePhotoCache();
  assert.equal(events.size, 0);
  assert.equal(timers.size, 0);
});
