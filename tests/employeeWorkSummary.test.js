import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEmployeeWorkSummary, employeeWorkSummaryRows, employeeWorkSummaryText,
  reportRecordDate, validReportRange,
} from '../src/utils/employeeWorkSummary.js';
import english from '../src/translations/additions/en.js';

const employee = { id: 'a', name: 'Employee A' };
const period = { startDate: '2026-10-01', endDate: '2026-10-31' };
const task = (id, date, extra = {}) => ({ id, employee_id: 'a', title: `Work ${id}`, status: 'completed', completion_date: date, ...extra });
const time = (date, hours, extra = {}) => ({ employee_id: 'a', date, hours, status: 'approved', hour_type: 'regular', ...extra });
const summary = (data, options = {}) => buildEmployeeWorkSummary(employee, data, { ...period, ...options });

test('monthly, quarterly, annual and custom summaries include both boundary dates', () => {
  const dates = ['2025-12-31', '2026-01-01', '2026-01-31', '2026-02-01', '2026-03-31', '2026-04-01', '2026-12-31', '2027-01-01'];
  const data = { tasks: dates.map((date, id) => task(id, date)) };
  for (const [startDate, endDate, expected] of [
    ['2026-01-01', '2026-01-31', 2],
    ['2026-01-01', '2026-03-31', 4],
    ['2026-01-01', '2026-12-31', 6],
    ['2026-01-31', '2026-04-01', 4],
    ['2025-12-31', '2026-01-01', 2],
    ['2026-01-31', '2026-01-31', 1],
  ]) assert.equal(summary(data, { startDate, endDate }).metrics.completedTasks, expected, `${startDate} → ${endDate}`);
});

test('validates calendar dates, leap years, missing and reversed custom ranges', () => {
  assert.equal(validReportRange('2028-02-29', '2028-02-29'), true);
  for (const [startDate, endDate] of [
    ['2026-02-29', '2026-03-01'], ['2026-02-30', '2026-03-01'],
    ['2026-04-31', '2026-05-01'], ['2026-10-31', '2026-10-01'],
    ['', '2026-10-01'], ['2026-10-01', null], ['bad', '2026-10-31'],
  ]) {
    assert.equal(validReportRange(startDate, endDate), false);
    assert.equal(summary({}, { startDate, endDate }), null);
  }
});

test('completed work follows completion dates; missing dates are disclosed rather than invented', () => {
  const result = summary({ tasks: [
    task(1, '2026-10-01', { due_date: '2026-09-01', description: 'Delivered the payroll migration.' }),
    task(2, '2026-11-01', { due_date: '2026-10-01' }),
    task(3, null, { due_date: '2026-10-31' }),
    task(4, null, { start_date: '2026-10-02' }),
    task(5, null, { created_at: '2026-10-03T23:59:59Z' }),
    task(6, null),
  ] });
  assert.equal(result.metrics.completedTasks, 4);
  assert.deepEqual(result.sections[0].items.map(item => item.key), ['task-1', 'task-3', 'task-4', 'task-5']);
  assert.match(result.notes.join(' '), /without a completion date: 3/);
  assert.match(employeeWorkSummaryText(result), /Delivered the payroll migration/);
  assert.equal(reportRecordDate(task(7, '2026-10-31T23:59:59Z')), '2026-10-31');
});

test('hours match attendance rules, include overtime and pending hours, and exclude other employees', () => {
  const result = summary({
    timeEntries: [
      time('2026-10-01', 8), time('2026-10-01', 2, { hour_type: 'overtime' }),
      time('2026-10-02', 4, { hour_type: 'wfh', status: 'pending' }),
      time('2026-10-03', 7, { status: 'rejected' }),
      time('2026-10-04', 8, { hour_type: 'on_leave' }),
      time('2026-10-05', 99, { employee_id: 'b' }),
      time('2026-11-01', 99),
    ],
    overtimeLogs: [{ employee_id: 'a', date: '2026-10-01', hours: 3, status: 'pending', overtime_type: 'holiday', reason: 'Release support' }],
    leave: [{ employee_id: 'a', start_date: '2026-09-30', end_date: '2026-10-01', status: 'approved' }],
  });
  assert.equal(result.metrics.totalHours, 9);
  assert.match(result.overview.join(' '), /9\.0 hours across 1 worked days/);
  assert.match(result.overview.join(' '), /5\.0 overtime hours and 4\.0 hours working from home/);
  assert.match(result.notes.join(' '), /7\.0 hours are awaiting approval/);
  assert.match(employeeWorkSummaryText(result), /Release support/);
});

test('scope excludes unticked work while approved leave still governs time totals', () => {
  const data = {
    tasks: [task(1, '2026-10-02')],
    goals: [{ employee_id: 'a', title: 'Hidden goal', target_date: '2026-10-02' }],
    timeEntries: [time('2026-10-01', 8), time('2026-10-02', 8)],
    leaveForAttendance: [{ employee_id: 'a', start_date: '2026-10-01', end_date: '2026-10-01', status: 'approved' }],
  };
  const timeOnly = summary(data, { scope: { timeEntries: true } });
  assert.equal(timeOnly.metrics.totalHours, 8);
  assert.equal(timeOnly.metrics.tasks, 0);
  assert.equal(timeOnly.metrics.goals, 0);
  assert.doesNotMatch(employeeWorkSummaryText(timeOnly), /Hidden goal|Work 1|Approved leave/);
  const tasksOnly = summary(data, { scope: { tasks: true } });
  assert.equal(tasksOnly.metrics.totalHours, 0);
  assert.equal(tasksOnly.metrics.completedTasks, 1);
  assert.doesNotMatch(tasksOnly.overview.join(' '), /hours/);
});

test('task statuses stay separate and assessments are preserved without inferring progress', () => {
  const result = summary({ tasks: [
    task(1, '2026-10-02', { description: 'Completed work description', self_assessment: 'Verified 28 records', comments: 'Reviewed by the team' }),
    task(2, null, { due_date: '2026-10-02', status: 'in-progress', comments: '80% done' }),
    task(3, null, { due_date: '2026-10-02', status: 'cancelled' }),
    task(4, '2026-10-02', { employee_id: 'b', title: 'Private work of B' }),
  ] });
  assert.equal(result.metrics.completedTasks, 1);
  assert.equal(result.metrics.tasks, 3);
  assert.equal(result.sections.find(section => section.key === 'other').items.length, 2);
  const text = employeeWorkSummaryText(result);
  assert.match(text, /Verified 28 records/);
  assert.match(text, /Reviewed by the team/);
  assert.match(text, /80% done/);
  assert.doesNotMatch(text, /Private work of B|100%|50%/);
});

test('groups repeated notes by text while preserving every distinct note and date beyond preview limits', () => {
  const entries = Array.from({ length: 584 }, (_, id) => time('2026-10-02', 1, { id, notes: `Work note ${id}` }));
  entries.push(time('2026-10-03', 1, { notes: 'Work note 0' }));
  entries.push(time('2026-10-04', 1, { notes: 'Rejected note', status: 'rejected' }));
  entries.push(time('2026-10-05', 8, { notes: 'Leave note', hour_type: 'on_leave' }));
  const result = summary({ timeEntries: entries });
  const notes = result.sections.find(section => section.key === 'notes');
  assert.equal(notes.items.length, 584);
  assert.equal(notes.items[0].date, '2026-10-02, 2026-10-03');
  assert.match(employeeWorkSummaryText(result), /Work note 583/);
  assert.doesNotMatch(employeeWorkSummaryText(result), /Rejected note|Leave note/);
});

test('goal progress uses the canonical field and explicitly identifies current data', () => {
  const result = summary({ goals: [
    { employee_id: 'a', title: 'Goal 1', target_date: '2026-10-02', progress_percentage: 20, progress: 90, status: 'in_progress', notes: 'Current update' },
    { employee_id: 'a', title: 'Goal 2', target_date: '2026-10-02', progress_percentage: 30, status: 'completed' },
    { employee_id: 'b', title: 'Another goal', target_date: '2026-10-02', progress_percentage: 100 },
  ] });
  assert.match(result.overview.join(' '), /current average progress: 60\.0%/);
  assert.match(result.notes.join(' '), /not a historical snapshot/);
  const text = employeeWorkSummaryText(result);
  assert.match(text, /20%/);
  assert.match(text, /Current update/);
  assert.doesNotMatch(text, /Another goal|90%/);
});

test('zero-record and invalid-employee results do not invent a performance summary', () => {
  const result = summary({ tasks: [task(1, '2026-11-01')] });
  assert.equal(result.hasRecords, false);
  assert.equal(result.sections.length, 0);
  assert.match(result.overview[0], /No work records were found/);
  assert.equal(buildEmployeeWorkSummary(null, {}, period), null);
  assert.equal(buildEmployeeWorkSummary({}, {}, period), null);
  assert.equal(employeeWorkSummaryText(null), '');
  assert.deepEqual(employeeWorkSummaryRows(null), []);
});

test('all summary translations preserve interpolation values in every supported language', async () => {
  const keys = Object.keys(english).filter(key => key.startsWith('reports.workSummary.'));
  const placeholders = value => [...value.matchAll(/\{\w+\}/g)].map(match => match[0]).sort();
  for (const locale of ['en', 'vn', 'de', 'fr', 'es', 'jp', 'kr', 'th', 'ru']) {
    const { default: translations } = await import(`../src/translations/additions/${locale}.js`);
    for (const key of keys) {
      assert.ok(translations[key], `${locale}: ${key}`);
      assert.deepEqual(placeholders(translations[key]), placeholders(english[key]), `${locale}: ${key}`);
    }
    const result = summary({ tasks: [task(1, '2026-10-02')] }, { t: (key, fallback) => translations[key] || fallback });
    assert.doesNotMatch(employeeWorkSummaryText(result), /\{(?:name|hours|days|total|completed)\}/);
  }
});
