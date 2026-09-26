import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import * as helpers from '../src/utils/reportExportHelpers.js';
import * as attendance from '../src/utils/attendanceRules.js';
import * as industry from '../src/theme/industry.js';
import * as employeeStatus from '../src/utils/employeeStatus.js';
import * as employeePosition from '../src/utils/employeePositionKey.js';
import * as locale from '../src/utils/localeFormat.js';
import { fetchAllRows } from '../src/utils/fetchAllRows.js';
import en from '../src/translations/en.js';
import { loadSource } from './helpers/loadSource.js';
import { queryFixture } from './helpers/queryFixture.js';

function find(tree, predicate) {
  if (tree && typeof tree === 'object' && predicate(tree)) return tree;
  for (const child of (Array.isArray(tree) ? tree : tree?.children || [])) {
    const match = find(child, predicate);
    if (match) return match;
  }
}

function exportFixture({ failEntries = false, employeeId = null } = {}) {
  const employees = ['a', 'b'].map(id => ({ id, name: `Employee ${id}`, department: 'Operations', status: 'Active' }));
  const entries = Array.from({ length: 584 }, (_, id) => ({
    id, employee_id: employees[id % 2].id, employee: employees[id % 2], date: '2026-07-06',
    clock_in: '09:00', clock_out: '17:00', hours: 8, hour_type: 'regular', status: 'approved',
    notes: `Record ${id}`, created_at: '2026-07-06T10:00:00Z',
  }));
  const client = queryFixture({ time_entries: entries }, failEntries ? { time_entries: { message: 'Read failed' } } : {}, { maxRows: 500 });
  const started = new Set();
  const gate = Promise.withResolvers();
  const from = client.from;
  client.from = table => {
    const query = from(table);
    const then = query.then;
    query.then = (resolve, reject) => {
      started.add('time');
      return gate.promise.then(() => then(resolve, reject));
    };
    return query;
  };
  const source = name => async () => {
    started.add(name);
    await gate.promise;
    return { success: true, data: [] };
  };
  const states = [];
  let cursor = 0, flushes = 0, downloaded = null, filename = null;
  const alerts = [];
  const translations = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) {
        let value = typeof initial === 'function' ? initial() : initial;
        if (value?.timeEntries && value?.employees) value = { timeEntries: entries, employees, tasks: [], goals: [], leave: [], overtimeLogs: [] };
        if (value?.startDate && value?.endDate) value = { startDate: '2026-07-01', endDate: '2026-09-30' };
        states[index] = value;
      }
      return [states[index], value => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useRef: value => ({ current: value }), useEffect() {}, useCallback: fn => fn, useMemo: fn => fn(),
  };
  const imports = {
    react, 'react-dom': { flushSync: fn => { flushes++; fn(); } },
    'react-router-dom': { useNavigate: () => () => {} }, 'lucide-react': {},
    '../contexts/LanguageContext': { SUPPORTED_LANGUAGES: { en: { name: 'English' } }, useLanguage: () => ({ currentLanguage: 'en', t: (key, fallback) => key.split('.').reduce((v, p) => v?.[p], en) || fallback || key }) },
    '../contexts/ThemeContext': { useTheme: () => ({ isDarkMode: false }) },
    '../contexts/AuthContext': { useAuth: () => ({ user: { id: 'admin', role: 'admin' } }) },
    '../hooks/useSessionGuard.js': { useSessionGuard: () => ({ handleSessionAuthError: () => false }), useAuthenticatedPageRefresh() {} },
    '../utils/demoHelper': { isDemoMode: () => false, getDemoEmployeeName: employee => employee?.name || 'Unknown' },
    '../services/timeTrackingService': { getOvertimeLogs: source('overtime'), getAllLeaveRequests: source('leave') },
    '../services/workloadService': { getAllTasks: source('tasks') },
    '../services/performanceService': { getAllPerformanceGoals: source('goals') },
    '../utils/supabaseTimeout': { withTimeout: promise => promise }, '../config/requestTimeouts': {},
    '../utils/sessionHelper': { validateAndRefreshSession: async () => ({ success: true }) },
    '../utils/retryHelper': {}, '../config/supabaseClient': { supabase: client },
    '../utils/fetchAllRows.js': { fetchAllRows }, '../utils/reportExportHelpers.js': helpers,
    '../utils/attendanceRules.js': attendance, '../utils/localeFormat.js': locale,
    '../services/translateService.js': { translateTexts: async texts => { translations.push(...texts); return texts.map(text => `Translated ${text}`); } },
    '../theme/industry.js': industry, '../utils/employeeStatus.js': employeeStatus,
    '../utils/employeePositionKey.js': employeePosition, '../utils/pdfFontLoader.js': {},
    '@/lib/utils': { cn: (...values) => values.filter(Boolean).join(' ') },
  };
  for (const name of ['./ui/translated-text.jsx', './ui/specular-button', './motion-primitives', './ui/number-ticker', './ui/date-picker.jsx', './ui/industry.jsx']) imports[name] = {};
  imports['./ui/fetch-elapsed-pill'] = { FetchElapsedPill: 'elapsed-pill' };
  const { default: Reports } = loadSource('src/components/reports.jsx', imports, {
    window: { localStorage: { getItem: () => null, setItem() {} } },
    URL: { createObjectURL: blob => { downloaded = blob; return 'blob:test'; }, revokeObjectURL() {} },
    document: { createElement: () => ({ click() { filename = this.download; } }), body: { appendChild() {}, removeChild() {} } },
    alert: message => {
      const screen = render();
      alerts.push({ message, active: find(screen, node => node.type === 'elapsed-pill').props.active, flushes });
    },
  });
  const render = () => { cursor = 0; return Reports(); };
  let screen = render();
  if (employeeId) {
    find(screen, node => node.props?.id === 'report-employee')
      .props.onChange({ target: { value: employeeId } });
    screen = render();
  }
  const button = find(screen, node => node.props?.title === en.reports.exportingIncludes);
  assert.ok(button);
  return { started, gate, client, alerts, translations, run: button.props.onClick, content: () => downloaded?.text(), filename: () => filename };
}

test('actual CSV export starts all sources together and writes all 584 rows beyond the first page', async () => {
  const fixture = exportFixture();
  const exporting = fixture.run();
  await setImmediate();
  assert.deepEqual([...fixture.started].sort(), ['goals', 'leave', 'overtime', 'tasks', 'time']);
  fixture.gate.resolve();
  await exporting;
  const csv = await fixture.content();
  assert.equal((csv.match(/Translated Record \d+/g) || []).length, 584);
  assert.ok(csv.includes('Translated Record 583'));
  assert.equal(fixture.translations.length, 584);
  assert.match(fixture.filename(), /2026-07-01_to_2026-09-30_EN\.csv$/);
  assert.equal(fixture.client.calls.filter(call => call.method === 'range').length, 2);
  assert.equal(fixture.alerts[0].active, false, 'loading must stop before the blocking success dialog');
  assert.equal(fixture.alerts[0].flushes, 1, 'commit the ready indicator before opening the dialog');
});

test('single-person export filters at the database and keeps only that employee', async () => {
  const fixture = exportFixture({ employeeId: 'a' });
  fixture.gate.resolve();
  await fixture.run();
  const csv = await fixture.content();
  assert.ok(fixture.client.calls.some(call => call.method === 'eq' && call.args[0] === 'employee_id' && call.args[1] === 'a'));
  assert.equal((csv.match(/Translated Record \d+/g) || []).length, 292);
  assert.ok(csv.includes('Employee a'));
  assert.ok(!csv.includes('Employee b'));
});

test('failed attendance fetch does not download an incomplete report', async () => {
  const fixture = exportFixture({ failEntries: true });
  fixture.gate.resolve();
  await fixture.run();
  assert.equal(fixture.content(), undefined);
  assert.match(fixture.alerts[0].message, /error/i);
});
