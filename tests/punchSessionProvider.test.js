import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { loadSource } from './helpers/loadSource.js';
import * as helpers from '../src/utils/punchSession.js';

function fixture({ remote, demo = false } = {}) {
  const values = [], effects = [], timers = [], stored = new Map(), writes = [];
  let cursor = 0, mounted = false;
  let auth = { isAuthenticated: true, user: { id: 'profile-one', employeeId: 'person-one' } };
  const initial = { date: helpers.localDate(new Date()), clockIn: 510, breaks: [] };
  const state = { remote: remote === undefined ? initial : remote, failSave: false };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => {
      const i = cursor++;
      if (!(i in values)) values[i] = typeof initial === 'function' ? initial() : initial;
      return [values[i], value => { values[i] = typeof value === 'function' ? value(values[i]) : value; }];
    },
    useRef: initial => { const i = cursor++; return values[i] ||= { current: initial }; },
    useEffect: effect => { if (!mounted) effects.push(effect); },
    useCallback: callback => callback,
    useMemo: factory => factory(),
  };
  const storage = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) };
  const window = { localStorage: storage, setInterval: fn => { timers.push(fn); return 1; }, clearInterval() {}, addEventListener() {}, removeEventListener() {} };
  const localHelpers = loadSource('src/utils/punchSession.js', {}, { window });
  const api = {
    getOpenPunch: async () => ({ success: true, data: state.remote }),
    saveOpenPunch: async (id, session) => {
      writes.push({ id, session });
      if (state.failSave) return { success: false, error: 'Write rejected' };
      state.remote = session;
      return { success: true, data: session };
    },
    clearOpenPunch: async () => { state.remote = null; return { success: true }; },
  };
  const { PunchSessionProvider } = loadSource('src/contexts/PunchSessionProvider.jsx', {
    react, './AuthContext.jsx': { useAuth: () => auth }, './PunchSessionContext.js': { PunchSessionContext: { Provider: 'provider' } },
    '../services/punchClockService.js': api, '../utils/demoHelper.js': { isDemoMode: () => demo },
    '../utils/punchSession.js': localHelpers,
  }, { React: react, window, document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} } });
  const render = () => { cursor = 0; const value = PunchSessionProvider({ children: null }).props.value; mounted = true; return value; };
  const mount = async () => { render(); effects.forEach(effect => effect()); await setImmediate(); return render(); };
  return { render, mount, initial, stored, writes, state, timers, api,
    switchUser: user => { auth = { isAuthenticated: true, user }; },
    logout: () => { auth = { isAuthenticated: false, user: null }; },
  };
}

test('global punch provider restores server state before enabling reminders', async () => {
  const f = fixture();
  assert.equal(f.render().ready, false);
  const context = await f.mount();
  assert.equal(context.ready, true);
  assert.equal(context.session.clockIn, 510);
  assert.deepEqual(JSON.parse(f.stored.get(helpers.punchSessionKey('person-one'))).breaks, []);
});

test('failed reminder save leaves the work timer and local mirror unchanged; retry persists the break', async () => {
  const f = fixture();
  await f.mount();
  f.state.failSave = true;
  assert.equal((await f.render().changeBreak(true)).success, false);
  assert.equal(f.render().session.breaks.length, 0);
  assert.equal(JSON.parse(f.stored.get(helpers.punchSessionKey('person-one'))).breaks.length, 0);
  f.state.failSave = false;
  assert.equal((await f.render().changeBreak(true)).success, true);
  assert.equal(f.render().session.clockIn, 510);
  assert.equal(f.render().session.breaks.length, 1);
  assert.equal(f.render().session.breaks[0].end, null);
});

test('a remote punch-out cannot be resurrected by a reminder action', async () => {
  const f = fixture();
  await f.mount();
  f.state.remote = null;
  assert.equal((await f.render().changeBreak(true)).success, false);
  assert.equal(f.render().session, null);
  assert.equal(f.writes.length, 0);
});

test('polling retries an offline punch action without overwriting it with an older server copy', async () => {
  const f = fixture();
  await f.mount();
  const next = { ...f.initial, breaks: [{ start: 720, end: null }] };
  f.state.failSave = true;
  assert.equal((await f.render().commit(next)).success, false);
  f.timers[0]();
  await setImmediate();
  assert.equal(f.render().session.breaks.length, 1);
  assert.deepEqual(JSON.parse(f.stored.get(helpers.punchSessionKey('person-one'))).breaks, next.breaks);
  f.state.failSave = false;
  f.timers[0]();
  await setImmediate();
  assert.deepEqual(f.state.remote.breaks, next.breaks);
  assert.equal(f.render().busy, false);
});

test('restoring a local punch serializes its save before a newer break action', async () => {
  const f = fixture({ remote: null });
  f.stored.set(helpers.punchSessionKey('person-one'), JSON.stringify(f.initial));
  let release;
  const save = f.api.saveOpenPunch;
  f.api.saveOpenPunch = async (...args) => {
    if (!release) await new Promise(resolve => { release = resolve; });
    return save(...args);
  };
  await f.mount();
  const next = { ...f.initial, breaks: [{ start: 720, end: null }] };
  const changing = f.render().commit(next);
  release();
  await changing;
  assert.deepEqual(f.state.remote.breaks, next.breaks);
  assert.deepEqual(f.render().session.breaks, next.breaks);
});

test('demo polling keeps a live punch without contacting remote storage', async () => {
  const f = fixture({ demo: true, remote: null });
  f.stored.set(helpers.punchSessionKey('person-one'), JSON.stringify(f.initial));
  await f.mount();
  f.timers[0]();
  await setImmediate();
  assert.equal(f.render().session.clockIn, 510);
  assert.equal(f.writes.length, 0);
});

test('changing or signing out the identity never exposes the previous employee session', async () => {
  const f = fixture();
  await f.mount();
  f.switchUser({ id: 'profile-two', employeeId: 'person-two' });
  assert.equal(f.render().session, null);
  assert.equal(f.render().employeeId, 'person-two');
  f.logout();
  assert.equal(f.render().session, null);
  assert.equal(f.render().employeeId, '');
});

test('an unlinked account cannot use the Auth UUID as an employee identifier', async () => {
  const f = fixture();
  f.switchUser({ id: 'unlinked-profile' });
  await f.mount();
  assert.equal(f.render().employeeId, '');
  assert.equal((await f.render().commit(f.initial)).success, false);
  assert.equal(f.writes.length, 0);
});

test('older server reads cannot overwrite a new local punch action', async () => {
  const f = fixture();
  let release;
  f.api.getOpenPunch = () => new Promise(resolve => { release = resolve; });
  f.render();
  // Start mount's read but do not let its stale response win after a write.
  const mounting = f.mount();
  await setImmediate();
  const next = { ...f.initial, breaks: [{ start: 720, end: null }] };
  await f.render().commit(next);
  release({ success: true, data: f.initial });
  await mounting;
  await setImmediate();
  assert.equal(f.render().session.breaks.length, 1);
  assert.equal(f.render().ready, true);
});
