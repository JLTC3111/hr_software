import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyLegacyTaskTab, DEFAULT_TASK_LIST_PREFERENCES, groupTaskListRows, isNewTaskAssignment,
  readTaskListPreferences, selectTaskListView, TASK_LIST_DUE_FILTERS, TASK_LIST_SORTS, TASK_LIST_STATUSES,
  writeTaskListPreferences,
} from '../src/utils/taskListView.js';

const row = (id, ownerId, status, due, dueDays, created_at, updated_at, closedAt = null) => ({
  id, ownerId, status, due, dueDays, closedAt, title: `Work ${id}`, ownerName: ownerId,
  mine: ownerId === 'a', open: ['pending', 'in-progress'].includes(status), task: { created_at, updated_at },
});
const rows = [
  row(5, 'a', 'completed', '2026-10-06', -6, '2026-10-01T10:00:00Z', '2026-10-10T10:00:00Z', '2026-10-09'),
  row(2, 'b', 'in-progress', '2026-10-12', 0, '2026-10-01T08:00:00Z', '2026-10-07T08:00:00Z'),
  row(4, 'a', 'pending', null, null, '2026-10-08T08:00:00Z', null),
  row(1, 'a', 'pending', '2026-10-07', -5, '2026-10-04T08:00:00Z', '2026-10-08T08:00:00Z'),
  row(6, 'b', 'completed', '2026-10-11', -1, '2026-10-02T08:00:00Z', '2026-10-11T08:00:00Z', '2026-10-03'),
  row(3, 'a', 'in-progress', '2026-10-13', 1, null, '2026-10-11T08:00:00Z'),
  row(7, 'a', 'cancelled', null, null, '2026-10-03T08:00:00Z', null),
];
const view = (preferences = {}, query) => selectTaskListView(rows, { ...DEFAULT_TASK_LIST_PREFERENCES, ...preferences }, query);
const ids = (list) => list.map(({ id }) => id);

test('fresh list ranks urgency globally and places completed rows in separate date-ordered history', () => {
  assert.equal(DEFAULT_TASK_LIST_PREFERENCES.groupByEmployee, false);
  assert.deepEqual(ids(view().open), [1, 2, 3, 4]);
  assert.deepEqual(ids(view().history), [5, 6, 7]);
  assert.deepEqual(ids(view({ owner: 'mine', status: 'in-progress', due: 'upcoming' }).open), [3]);
  assert.deepEqual(ids(view({ owner: 'mine', status: 'in-progress', due: 'overdue' }).open), []);
  assert.deepEqual(ids(view({ owner: 'b', status: 'completed' }).history), [6]);
  assert.deepEqual(ids(view({ status: 'cancelled' }).history), [7]);
  assert.deepEqual(ids(view({ owner: 'mine' }, 'Work 4').open), [4]);
});

test('each date field sorts independently in both directions with missing values last', () => {
  for (const [sort, direction, open, history] of [
    ['created_at', 'asc', [2, 1, 4, 3], [5, 6, 7]],
    ['created_at', 'desc', [4, 1, 2, 3], [7, 6, 5]],
    ['updated_at', 'asc', [2, 1, 3, 4], [5, 6, 7]],
    ['updated_at', 'desc', [3, 1, 2, 4], [6, 5, 7]],
    ['due_date', 'asc', [1, 2, 3, 4], [5, 6, 7]],
    ['due_date', 'desc', [3, 2, 1, 4], [6, 5, 7]],
    ['completion_date', 'asc', [1, 2, 3, 4], [6, 5, 7]],
    ['completion_date', 'desc', [1, 2, 3, 4], [5, 6, 7]],
  ]) {
    assert.deepEqual(ids(view({ sort, direction }).open), open, `open ${sort} ${direction}`);
    assert.deepEqual(ids(view({ sort, direction }).history), history, `history ${sort} ${direction}`);
  }
});

test('grouping leaves membership, counts and order within each employee intact in all filter and sort combinations', () => {
  for (const owner of ['all', 'mine', 'b']) {
    for (const status of TASK_LIST_STATUSES) {
      for (const due of TASK_LIST_DUE_FILTERS) {
        for (const sort of TASK_LIST_SORTS) {
          for (const direction of ['asc', 'desc']) {
            for (const result of Object.values(view({ owner, status, due, sort, direction }))) {
              const grouped = groupTaskListRows(result, true);
              assert.deepEqual(ids(grouped.flatMap(group => group.rows)).sort(), ids(result).sort());
              for (const group of grouped) assert.deepEqual(ids(group.rows), ids(result.filter(task => task.ownerId === group.key)));
              assert.deepEqual(groupTaskListRows(result, false)[0].rows, result);
            }
          }
        }
      }
    }
  }
});

test('preferences survive a fresh read per user and legacy links override only their own view', () => {
  const previousStorage = globalThis.localStorage;
  const items = new Map();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, value),
  } });
  try {
    const preference = { owner: 'b', status: 'completed', due: 'all', sort: 'completion_date', direction: 'desc', groupByEmployee: true };
    writeTaskListPreferences('alpha', preference);
    assert.deepEqual(readTaskListPreferences('alpha'), preference);
    assert.deepEqual(readTaskListPreferences('beta'), DEFAULT_TASK_LIST_PREFERENCES);
    assert.deepEqual(applyLegacyTaskTab(readTaskListPreferences('alpha'), 'overdue'), { ...preference, status: 'open', due: 'overdue' });
    assert.deepEqual(readTaskListPreferences('alpha'), preference);
    items.set([...items.keys()][0], '{malformed');
    assert.deepEqual(readTaskListPreferences('alpha'), DEFAULT_TASK_LIST_PREFERENCES);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: previousStorage });
  }
});

test('new assignment indicator requires a recent creation time and a recorded different assigner', () => {
  const now = Date.parse('2026-10-13T12:00:00Z');
  const assigned = { created_at: '2026-10-13T08:00:00Z', created_by: 'b', employee_id: 'a' };
  assert.equal(isNewTaskAssignment(assigned, now), true);
  for (const edited of [{ created_by: null }, { created_by: 'a' }, { created_at: null }, { created_at: '2026-10-14T08:00:00Z' }, { created_at: '2026-10-12T12:00:00Z' }]) {
    assert.equal(isNewTaskAssignment({ ...assigned, ...edited }, now), false);
  }
});
