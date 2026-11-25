import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { loadSource } from './helpers/loadSource.js';
import * as employeeStatus from '../src/utils/employeeStatus.js';
import * as employeePosition from '../src/utils/employeePositionKey.js';
import * as reportHelpers from '../src/utils/reportExportHelpers.js';
import * as taskListView from '../src/utils/taskListView.js';
import * as workloadDates from '../src/utils/workloadDates.js';
import * as industry from '../src/theme/industry.js';
import english from '../src/translations/en.js';
import vietnamese from '../src/translations/vn.js';
import englishAdditions from '../src/translations/additions/en.js';
import vietnameseAdditions from '../src/translations/additions/vn.js';

const employees = [{ id: 'a', name: 'Employee A' }, { id: 'b', name: 'Employee B' }];
const today = '2026-10-12';
const task = (id, fields) => ({ id, title: `Task ${id}`, employee_id: 'a', status: 'pending', ...fields });
const tasks = [
  task(1, { status: 'in-progress', due_date: '2026-10-13', created_at: '2026-10-06T03:18:00Z' }),
  task(2, { employee_id: 'b', due_date: '2026-10-11' }),
  task(3, { due_date: today, created_at: '2026-10-08T03:18:00Z' }),
  task(4, { status: 'completed', completion_date: '2026-10-06', due_date: '2026-10-08' }),
  task(5, { status: 'cancelled' }),
];

function elements(tree, predicate) {
  if (tree == null || typeof tree !== 'object') return [];
  const children = Array.isArray(tree) ? tree : tree.children || [];
  return [...(predicate(tree) ? [tree] : []), ...children.flatMap((child) => elements(child, predicate))];
}

function fixture({ records = tasks, error = null, dark = false, language = 'en', tab = null, persistence = null } = {}) {
  const state = [];
  const refs = [];
  const effects = [];
  const navigation = { task: null, tab };
  const calls = [];
  let cursor = 0, refCursor = 0;
  const react = {
    Fragment: 'fragment', createElement: (type, props, ...children) => ({ type, props, children }),
    useState(initial) {
      const i = cursor++;
      if (!(i in state)) state[i] = typeof initial === 'function' ? initial() : initial;
      return [state[i], (next) => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
    },
    useRef: (value) => refs[refCursor++] ||= { current: value },
    useMemo: (callback) => callback(), useCallback: (callback) => callback,
    useEffect: (effect) => { effects.push(effect); },
  };
  const ui = Object.fromEntries(['Blueprint', 'Bar', 'Tag', 'Btn', 'TickerCell', 'LiveClock', 'ColumnHeading', 'FlatListbox'].map((name) => [name, name]));
  const translate = (key, fallback) => {
    const nested = language === 'vn' ? vietnamese : english;
    const additions = language === 'vn' ? vietnameseAdditions : englishAdditions;
    return additions[key] ?? key.split('.').reduce((node, part) => node?.[part], nested) ?? fallback;
  };
  const { default: TaskList } = loadSource('src/components/taskListing.jsx', {
    react, 'lucide-react': {},
    '../contexts/AuthContext.jsx': { useAuth: () => ({ user: { id: 'fixture', employeeId: 'a', role: 'admin' }, checkPermission: () => true }) },
    '../contexts/ThemeContext.jsx': { useTheme: () => ({ isDarkMode: dark }) },
    '../contexts/LanguageContext.jsx': { useLanguage: () => ({ t: translate, currentLanguage: language }) },
    '../services/workloadService.js': {
      getAllTasks: async () => error ? { success: false, error } : { success: true, data: records },
      bulkUpdateTaskStatus: async (...args) => { calls.push(args); return { success: true }; },
      updateTask: async (...args) => { calls.push(args); return { success: true }; },
    },
    '../hooks/useSessionGuard.js': { useSessionGuard: () => ({ handleSessionAuthError: () => false }), useAuthenticatedPageRefresh() {} },
    '../utils/sessionHelper.js': { validateAndRefreshSession: async () => ({ success: true }) },
    '../hooks/useWorkloadTaskRefresh.js': { useWorkloadTaskRefresh() {} },
    '../utils/demoHelper.js': { isDemoMode: () => false, getDemoEmployeeName: (row) => row.name },
    '../utils/employeeStatus.js': employeeStatus, '../utils/employeePositionKey.js': employeePosition,
    '../utils/reportExportHelpers.js': reportHelpers,
    '../utils/workloadDates.js': { ...workloadDates, vietnamCalendarDay: (value = today) => workloadDates.vietnamCalendarDay(value) },
    '../utils/taskListView.js': {
      ...taskListView,
      readTaskListPreferences: (id) => persistence?.get(id) ?? taskListView.DEFAULT_TASK_LIST_PREFERENCES,
      writeTaskListPreferences: (id, value) => persistence?.set(id, value),
    },
    '../theme/industry.js': industry,
    '../hooks/useScreenNavigation.js': { useScreenNavigation: () => [navigation, (patch) => Object.assign(navigation, patch)] },
    './ui/date-picker.jsx': { DatePicker: 'date-picker' },
    './ui/translated-text.jsx': { TranslatedText: 'translated' },
    './ui/fetch-elapsed-pill': { FetchElapsedPill: 'fetching' },
    './ui/industry.jsx': ui,
  }, { React: react, setTimeout() {} });
  const render = () => { cursor = 0; refCursor = 0; effects.length = 0; return TaskList({ employees }); };
  const find = (predicate) => elements(render(), predicate)[0];
  return {
    async load() { render(); effects.forEach((effect) => effect()); await setImmediate(); },
    ids: () => elements(render(), ({ props }) => props?.['data-task-row']).map(({ props }) => props['data-task-row']),
    control: (key) => find(({ props }) => props?.id === `task-${key}` && props.onChange),
    history: () => find(({ props }) => props?.['aria-controls'] === 'task-list-history'),
    find, calls, navigation, render,
  };
}

test('real controls apply scope, sorting, history, and persistent preferences to rendered rows', async () => {
  const persistence = new Map();
  const screen = fixture({ persistence });
  await screen.load();
  assert.deepEqual(screen.ids(), [2, 3, 1]);
  assert.equal(screen.history().props['aria-expanded'], false);
  screen.control('owner').props.onChange({ target: { value: 'mine' } });
  screen.control('status').props.onChange({ target: { value: 'pending' } });
  assert.deepEqual(screen.ids(), [3]);
  screen.find(({ props }) => props?.['aria-pressed'] === false).props.onClick();
  assert.ok(screen.find(({ props }) => props?.['data-task-group'] === 'a'));
  screen.control('sort').props.onChange({ target: { value: 'created_at' } });
  screen.control('direction').props.onChange({ target: { value: 'desc' } });
  screen.history().props.onClick();
  assert.deepEqual(screen.ids(), [3, 4, 5]);
  const fresh = fixture({ dark: true, language: 'vn', persistence });
  await fresh.load();
  assert.equal(fresh.control('sort').props['aria-label'], 'Sắp xếp theo');
  assert.equal(fresh.control('direction').props.value, 'desc');
  assert.ok(fresh.find(({ props }) => props?.['data-task-group'] === 'a'));
  assert.equal(fresh.history().props['aria-expanded'], false);
  assert.deepEqual(fresh.ids(), [3]);
});

test('failed reads present an error without displaying a successful empty queue', async () => {
  const screen = fixture({ error: 'Read failed' });
  await screen.load();
  assert.ok(screen.find(({ children }) => children?.includes('Failed to load tasks')));
  assert.deepEqual(screen.ids(), []);
  assert.equal(screen.history(), undefined);
  assert.equal(screen.find(({ children }) => children?.includes('No open tasks.')), undefined);
});
