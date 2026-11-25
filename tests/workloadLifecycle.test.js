import assert from 'node:assert/strict';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { loadSource } from './helpers/loadSource.js';
import * as dates from '../src/utils/workloadDates.js';
import { computeEmployeePerformance, getTaskDurationDays } from '../src/utils/reportExportHelpers.js';

test('Vietnam calendar days and displayed dates agree from Vietnam, UTC and Los Angeles', () => {
  const program = `import { vietnamCalendarDay, formatWorkloadDay, formatWorkloadTimestamp } from './src/utils/workloadDates.js';
    console.log(JSON.stringify([
      vietnamCalendarDay('2026-09-30T16:59:59Z'), vietnamCalendarDay('2026-09-30T17:00:00Z'),
      vietnamCalendarDay('2026-10-31T16:59:59Z'), vietnamCalendarDay('2026-10-31T17:00:00Z'),
      formatWorkloadDay('2026-10-01', 'vn', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      formatWorkloadTimestamp('2026-10-01', 'vn', { hour: '2-digit' })
    ]));`;
  for (const TZ of ['Asia/Ho_Chi_Minh', 'UTC', 'America/Los_Angeles']) {
    const raw = execFileSync(process.execPath, ['--input-type=module', '-e', program], { env: { ...process.env, TZ }, encoding: 'utf8' });
    assert.deepEqual(JSON.parse(raw), ['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01', '01/10/2026', ''], TZ);
  }
});

test('report attribution uses verified completion, then due, start and Vietnam creation for work still open', () => {
  const tasks = [
    { id: 1, status: 'completed', completion_date: '2026-10-01', due_date: '2026-09-23', created_at: '2026-09-01T08:00:00Z' },
    { id: 2, status: 'completed', completion_date: '2026-10-31', due_date: '2026-11-02', created_at: '2026-11-01T12:00:00Z' },
    { id: 3, status: 'pending', due_date: '2026-11-03', start_date: '2026-10-01' },
    { id: 4, status: 'in-progress', start_date: '2026-10-29', created_at: '2026-08-28T12:00:00Z' },
    { id: 5, status: 'pending', created_at: '2026-09-30T17:00:00Z' },
    { id: 6, status: 'pending', completion_date: '2026-09-01', start_date: '2026-09-28', due_date: '2026-10-09' },
    { id: 7, status: 'completed', start_date: '2026-11-02', completion_date: null },
    { id: 8, status: 'completed', completion_date: '2026-11-29' },
    { id: 9, status: 'completed', completion_date: null, due_date: '2026-10-12', updated_at: '2026-10-12T12:00:00Z' },
  ];
  const today = '2026-11-25';
  const october = dates.selectReportTasks(tasks, { startDate: '2026-10-01', endDate: '2026-10-31', today });
  assert.deepEqual(october.tasks.map(({ id }) => id), [1, 2, 4, 5, 6]);
  assert.deepEqual(october.taskDateIssues.map(({ task, issue }) => [task.id, issue]), [[9, 'missing']]);
  const november = dates.selectReportTasks(tasks, { startDate: '2026-11-01', endDate: '2026-11-30', today });
  assert.deepEqual(november.tasks.map(({ id }) => id), [3]);
  assert.deepEqual(november.taskDateIssues.map(({ task, issue }) => [task.id, issue]), [[7, 'missing'], [8, 'future'], [9, 'missing']]);
  assert.equal(getTaskDurationDays(tasks[5], '2026-10-06').actual, 8);
});

test('cancelled work remains visible as a record and carries no completion weight', () => {
  const employee = { id: 'one' };
  const cancelled = { employee_id: employee.id, status: 'cancelled', completion_date: '2026-09-10' };
  const pending = { employee_id: employee.id, status: 'pending' };
  const performance = computeEmployeePerformance(employee, [], [cancelled, pending], [], {
    startDate: '2026-09-01', endDate: '2026-09-30',
  });
  assert.equal(performance.recordedTasksCount, 2);
  assert.equal(performance.tasksCount, 1);
  assert.equal(performance.completedTasks, 0);
  assert.equal(performance.taskScore, '0.0');
  assert.equal(computeEmployeePerformance(employee, [], [cancelled]).taskScore, null);
});

test('task service preserves recorded dates on unrelated edits and uses the status RPC for single or bulk actions', async () => {
  const calls = [];
  const query = {
    insert: (value) => { calls.push(['insert', value]); return query; },
    update: (value) => { calls.push(['update', value]); return query; },
    select: () => query, eq: () => query, single: () => ({ data: { id: 7 }, error: null }),
  };
  const service = loadSource('src/services/workloadService.js', {
    '../config/supabaseClient': { supabase: {
      from: () => query,
      rpc: (name, args) => { calls.push([name, args]); return { data: [], error: null }; },
    } },
    '../utils/demoHelper': { isDemoMode: () => false },
    '../utils/fetchAllRows.js': {}, '../utils/workloadDates.js': dates,
  });
  assert.equal((await service.createTask({ employeeId: 'one', title: 'Done', status: 'completed' })).success, false);
  assert.equal((await service.createTask({ employeeId: 'one', title: 'Done', status: 'completed', completionDate: '2090-01-01' })).success, false);
  assert.equal(calls.length, 0);
  assert.equal((await service.createTask({ employeeId: 'one', title: 'Done', status: 'completed', completionDate: '2026-09-01' })).success, true);
  assert.equal(calls[0][1][0].completion_date, '2026-09-01');
  await service.updateTask(7, { comments: 'Reviewed', dueDate: null });
  assert.deepEqual({ ...calls[1][1] }, { comments: 'Reviewed', due_date: null });
  await service.updateTask(7, { status: 'pending' });
  assert.deepEqual({ ...calls[2][1] }, { status: 'pending', completion_date: null });
  await service.bulkUpdateTaskStatus([7, 7, 8], 'completed');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[3])), ['set_workload_task_status', { p_task_ids: ['7', '8'], p_status: 'completed' }]);
});

test('private task channel forwards only a refresh signal and shares an existing subscription', async () => {
  const changes = [];
  let receive;
  const channel = {
    on(type, options, callback) { changes.push([type, options.event]); receive = callback; return this; },
    subscribe(callback) { callback('SUBSCRIBED'); return this; },
  };
  const service = loadSource('src/services/workloadService.js', {
    '../config/supabaseClient': { supabase: {
      channel: (topic, options) => { changes.push([topic, options.config.private]); return channel; },
      removeChannel: async () => { changes.push(['removed']); },
    } },
    '../utils/demoHelper': {}, '../utils/fetchAllRows.js': {}, '../utils/workloadDates.js': dates,
  });
  const received = [];
  const closeA = service.subscribeToTaskChanges('one', (...args) => received.push(args));
  const closeB = service.subscribeToTaskChanges('one', (...args) => received.push(args));
  receive({ payload: { id: 'opaque' } });
  closeA();
  assert.deepEqual(received, [[], [], []]);
  assert.deepEqual(changes, [['hr:workload:one', true], ['broadcast', 'changed']]);
  closeB();
  assert.deepEqual(changes.at(-1), ['removed']);
});
