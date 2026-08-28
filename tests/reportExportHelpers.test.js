import test from 'node:test';
import assert from 'node:assert/strict';
import { getTaskDurationDays } from '../src/utils/reportExportHelpers.js';

const now = new Date(2026, 7, 28); // 28 Aug 2026, local

test('logged-after-the-fact completed task uses start→due and start→completion', () => {
  const duration = getTaskDurationDays({
    created_at: new Date(2026, 7, 28),
    start_date: '2026-08-14',
    due_date: '2026-08-22',
    completion_date: '2026-08-21',
    status: 'completed',
    updated_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: 8, actual: 7, variance: -1 });
});

test('created_at is ignored when start_date is missing', () => {
  const duration = getTaskDurationDays({
    created_at: new Date(2026, 7, 20),
    due_date: '2026-08-27',
    status: 'completed',
    completion_date: '2026-08-21',
    updated_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: null, actual: null, variance: null });
});

test('open task with a start measures actual days through today', () => {
  const duration = getTaskDurationDays({
    start_date: '2026-08-20',
    due_date: '2026-08-30',
    status: 'in_progress',
    created_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: 10, actual: 8, variance: -2 });
});

test('same-day start and due still counts as at least one estimated day', () => {
  const duration = getTaskDurationDays({
    start_date: '2026-08-28',
    due_date: '2026-08-28',
    status: 'in-progress',
  }, now);

  assert.equal(duration.estimated, 1);
  assert.equal(duration.actual, 0);
});

test('pending task with no start date cannot be measured', () => {
  const duration = getTaskDurationDays({
    due_date: '2026-08-30',
    status: 'pending',
    created_at: new Date(2026, 7, 28),
  }, now);

  assert.deepEqual(duration, { estimated: null, actual: null, variance: null });
});
