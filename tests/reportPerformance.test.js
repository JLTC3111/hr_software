import test from 'node:test';
import assert from 'node:assert/strict';
import { computeEmployeePerformance, expectedReportHours } from '../src/utils/reportExportHelpers.js';

const employee = { id: 'a' };
const period = { startDate: '2026-09-01', endDate: '2026-09-30' };
const time = (hours, extra = {}) => ({ employee_id: 'a', date: '2026-09-10', hours, hour_type: 'regular', status: 'approved', ...extra });
const task = (extra = {}) => ({ employee_id: 'a', status: 'completed', start_date: '2026-09-01', due_date: '2026-09-11', completion_date: '2026-09-21', ...extra });

test('expected hours use 22 eight-hour days per full month and prorate partial months', () => {
  for (const [start, end] of [['2026-09-01', '2026-09-30'], ['2026-01-01', '2026-01-31'], ['2028-02-01', '2028-02-29']]) {
    assert.equal(expectedReportHours(start, end), 176);
  }
  assert.equal(expectedReportHours('2026-09-01', '2026-09-15'), 88);
  assert.equal(expectedReportHours('2026-07-01', '2026-09-30'), 528);
  assert.equal(expectedReportHours('2026-08-16', '2026-09-15'), 176 * 16 / 31 + 88);
  assert.equal(expectedReportHours('2026-09-30', '2026-09-01'), null);
  assert.equal(expectedReportHours(null, null), null);
});

test('score weights actual time 50%, completed volume and duration 45%, goals 5%', () => {
  const performance = computeEmployeePerformance(employee, [time(88)], [task(), task()], [
    { employee_id: 'a', status: 'in_progress', progress_percentage: 20, progress: 99 },
  ], period);
  assert.equal(performance.timeScore, '50.0');
  assert.equal(performance.taskCompletionRate, '100.0');
  assert.equal(performance.taskEfficiency, '50.0');
  assert.equal(performance.estimatedTaskDays, 20);
  assert.equal(performance.actualTaskDays, 40);
  assert.equal(performance.taskScore, '75.0');
  assert.equal(performance.avgGoalProgress, '20.0');
  assert.deepEqual(performance.weights, { time: 50, tasks: 45, goals: 5 });
  assert.equal(performance.overallScore, '59.8');
});

test('absent goals contribute no weight; recorded goals at zero still count', () => {
  const missing = computeEmployeePerformance(employee, [time(88)], [task()], [], period);
  const zero = computeEmployeePerformance(employee, [time(88)], [task()], [{ employee_id: 'a', progress: 0 }], period);
  assert.equal(missing.overallScore, '61.8');
  assert.equal(missing.weights.goals, 0);
  assert.ok(Math.abs(missing.weights.time + missing.weights.tasks - 100) < 0.00001);
  assert.equal(zero.overallScore, '58.8');
  assert.equal(zero.weights.goals, 5);
});

test('hours and overtime change the score even if every entry is approved', () => {
  const low = computeEmployeePerformance(employee, [time(88)], [task()], [], period);
  const high = computeEmployeePerformance(employee, [time(176)], [task()], [], period);
  const overtime = computeEmployeePerformance(employee, [time(88)], [task()], [], {
    ...period, overtimeLogs: [time(16, { overtime_type: 'holiday' })],
  });
  assert.equal(low.timeApprovalRate, high.timeApprovalRate);
  assert.equal(low.overallScore, '61.8');
  assert.equal(high.overallScore, '88.2');
  assert.equal(overtime.totalHours, 104);
  assert.equal(overtime.overtimeHours, 16);
  assert.ok(Number(overtime.overallScore) > Number(low.overallScore));
  assert.equal(computeEmployeePerformance(employee, [time(220)], [task()], [], period).timeScore, '100.0');
});

test('task delivery uses completed/assigned counts and never guesses progress from notes', () => {
  const performance = computeEmployeePerformance(employee, [time(176)], [
    task({ completion_date: '2026-09-11' }),
    task({ status: 'in-progress', completion_date: null, comments: '80% complete' }),
  ], [], period);
  assert.equal(performance.taskCompletionRate, '50.0');
  assert.equal(performance.taskEfficiency, '100.0');
  assert.equal(performance.taskScore, '75.0');
  assert.equal(performance.measuredTaskCount, 1);
});

test('missing or inconsistent dates are excluded from duration scoring', () => {
  const performance = computeEmployeePerformance(employee, [], [
    task({ start_date: null }),
    task({ due_date: '2026-08-01' }),
    task({ completion_date: '2026-08-01' }),
    task({ completion_date: null }),
    task({ status: 'pending', completion_date: null }),
  ], [], period);
  assert.equal(performance.taskEfficiency, null);
  assert.equal(performance.measuredTaskCount, 0);
  assert.equal(performance.taskScore, '80.0');
  assert.equal(performance.overallScore, '37.9', 'zero recorded hours must not transfer the time weight to tasks');
});

test('empty scope has no score; records belonging to another employee do not affect it', () => {
  const performance = computeEmployeePerformance(employee, [time(88, { employee_id: 'b' })], [task({ employee_id: 'b' })], [], period);
  assert.equal(performance.overallScore, null);
  assert.equal(performance.timeScore, null);
  assert.deepEqual(performance.weights, { time: 0, tasks: 0, goals: 0 });
});

test('approved leave and rejected hours retain the shared attendance exclusions', () => {
  const performance = computeEmployeePerformance(employee, [time(8), time(8, { date: '2026-09-11', status: 'rejected' }), time(2, { hour_type: 'overtime' })], [], [], {
    ...period, leaveRequests: [{ employee_id: 'a', start_date: '2026-09-10', end_date: '2026-09-10', status: 'approved' }],
  });
  assert.equal(performance.regularHours, 0);
  assert.equal(performance.overtimeHours, 2);
  assert.equal(performance.totalHours, 2);
});

test('goals alone cannot replace the time and task weights', () => {
  const performance = computeEmployeePerformance(employee, [], [], [{ employee_id: 'a', status: 'completed' }], period);
  assert.equal(performance.overallScore, '5.0');
  assert.equal(performance.timeScore, '0.0');
  assert.equal(performance.taskScore, '0.0');
  assert.deepEqual(performance.weights, { time: 50, tasks: 45, goals: 5 });
});
